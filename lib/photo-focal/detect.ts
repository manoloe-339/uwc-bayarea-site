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

export type Focal = { x: number; y: number };

/** Detect the dominant face in a JPEG/PNG buffer. Returns {x,y} as
 *  0..100 ints (percentages of the source image) or null if no face
 *  cleared the 0.5 confidence threshold. */
export async function detectFocal(buf: Buffer): Promise<Focal | null> {
  await init();
  const { tensor, width, height } = await bufferToTensor(buf);
  try {
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    const detections = await faceapi.detectAllFaces(
      tensor as unknown as faceapi.TNetInput,
      options,
    );
    if (!detections || detections.length === 0) return null;
    let best = detections[0];
    let bestArea = best.box.width * best.box.height;
    for (const d of detections.slice(1)) {
      const a = d.box.width * d.box.height;
      if (a > bestArea) {
        best = d;
        bestArea = a;
      }
    }
    // Pull the focal slightly above face center — composes as
    // "head + a sliver of neck/shoulder" rather than face-dead-centered.
    const cx = best.box.x + best.box.width / 2;
    const cy = best.box.y + best.box.height * 0.45;
    return {
      x: clampPercent((cx / width) * 100),
      y: clampPercent((cy / height) * 100),
    };
  } finally {
    tensor.dispose();
  }
}
