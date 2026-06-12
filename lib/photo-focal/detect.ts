/**
 * Single-image face detection for the per-alum focal-point pipeline.
 * Runs entirely in a Vercel function: pure-JS tfjs + WASM backend, no
 * tfjs-node native binary. The SSD MobileNet weights ship with the
 * deployment via outputFileTracingIncludes (see next.config.mjs).
 *
 * Model state is cached in module scope, so on Fluid Compute the
 * 5.6 MB weights load once per warm instance instead of per request.
 */
// face-api ships several build flavours; the node-wasm dist is the
// one we need for serverless: pure Node + tfjs WASM backend, no
// tfjs-node native binary. It re-exports tfjs + tfjs-backend-wasm
// from the same module so we only deal with one registry.
import * as faceapi from "@vladmandic/face-api/dist/face-api.node-wasm.js";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import * as tf from "@tensorflow/tfjs";
import path from "node:path";
import sharp from "sharp";

let initialized = false;
let initPromise: Promise<void> | null = null;

async function init() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // WASM binaries are not bundled — point tfjs at the jsdelivr CDN
    // so it grabs the .wasm shards on first use. Tiny one-time cost
    // per warm instance.
    setWasmPaths(
      `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${tf.version_core}/dist/`,
    );
    await tf.setBackend("wasm");
    await tf.ready();

    const modelsDir = path.join(process.cwd(), "face-api-models");
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsDir);
    initialized = true;
  })();
  return initPromise;
}

async function bufferToTensor(buf: Buffer) {
  const { data, info } = await sharp(buf)
    .rotate()
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) {
    throw new Error(`unexpected channel count: ${info.channels}`);
  }
  const tensor = tf.tensor3d(
    new Uint8Array(data),
    [info.height, info.width, 3],
    "int32",
  );
  return { tensor, width: info.width, height: info.height };
}

function clampPercent(v: number) {
  const n = Math.round(v);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export type FaceBox = {
  /** Focal point — center of face, biased slightly upward so the
   *  composition reads as "head + sliver of shoulder". 0..100. */
  focalX: number;
  focalY: number;
  /** Face bounding box in source-image pixels. Used by the batch
   *  runner to bake a tight head-focused derivative. */
  pixelX: number;
  pixelY: number;
  pixelW: number;
  pixelH: number;
  /** Source image dimensions in pixels. */
  imgW: number;
  imgH: number;
};

/** Detect the dominant face in a JPEG/PNG buffer. Returns box + focal
 *  metrics, or null if no face cleared the 0.5 confidence threshold. */
export async function detectFace(buf: Buffer): Promise<FaceBox | null> {
  await init();
  const { tensor, width, height } = await bufferToTensor(buf);
  try {
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    const detections = await faceapi.detectAllFaces(
      tensor as unknown as faceapi.TNetInput,
      options,
    );
    if (!detections || detections.length === 0) return null;
    // Pick by confidence first; size only as a tiebreaker for
    // similarly-confident detections (group photos with multiple
    // legit faces — usually the subject is the largest).
    //
    // The plain "largest area wins" rule had a failure mode where a
    // low-confidence false positive in jewelry/background scored
    // ~0.5 but happened to have a larger bounding box than the
    // real face at 1.0 — and the bake centered on the phantom.
    // 0.05 is tight enough that two real faces in a group photo will
    // still both be considered (typical inter-face confidence delta
    // is well under 0.05), but tight enough that an obvious phantom
    // (~0.10+ below the real face's score) loses to confidence.
    const SCORE_TIE = 0.05;
    const sorted = [...detections].sort((a, b) => {
      if (Math.abs(a.score - b.score) > SCORE_TIE) return b.score - a.score;
      return b.box.width * b.box.height - a.box.width * a.box.height;
    });
    const best = sorted[0];
    const cx = best.box.x + best.box.width / 2;
    const cy = best.box.y + best.box.height * 0.45;
    return {
      focalX: clampPercent((cx / width) * 100),
      focalY: clampPercent((cy / height) * 100),
      pixelX: best.box.x,
      pixelY: best.box.y,
      pixelW: best.box.width,
      pixelH: best.box.height,
      imgW: width,
      imgH: height,
    };
  } finally {
    tensor.dispose();
  }
}
