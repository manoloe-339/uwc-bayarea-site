/**
 * Local one-shot to bake head-focused JPEG derivatives for alumni.
 * Mirrors lib/photo-focal/run-batch.ts but uses tfjs-node directly
 * (much faster than the WASM backend the serverless route is
 * limited to). Useful for backfilling existing rows in bulk without
 * juggling 300 s function timeouts.
 *
 *   node scripts/bake-headshots.mjs                # everyone missing a headshot
 *   node scripts/bake-headshots.mjs --id 204       # one alum
 *   node scripts/bake-headshots.mjs --ids 39,204,2012
 *
 * Env: reads DATABASE_URL + BLOB_READ_WRITE_TOKEN from .env.local
 * (or process.env).
 */
import { createRequire } from "node:module";
const __require = createRequire(import.meta.url);
const __util = __require("util");
if (typeof __util.isNullOrUndefined !== "function") {
  __util.isNullOrUndefined = (v) => v === null || v === undefined;
}

import * as tf from "@tensorflow/tfjs-node";
import * as faceapi from "@vladmandic/face-api";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

function envVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync("./.env.local", "utf8");
    const m = env.match(new RegExp(`^${name}="([^"]+)"$`, "m"));
    if (m) return m[1];
  } catch {}
  throw new Error(`missing ${name}`);
}
// @vercel/blob reads BLOB_READ_WRITE_TOKEN off process.env, so make
// sure it's there even when .env.local is the source of truth.
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  process.env.BLOB_READ_WRITE_TOKEN = envVar("BLOB_READ_WRITE_TOKEN");
}
const sql = neon(envVar("DATABASE_URL"));

const ID_ARG = (() => {
  const i = process.argv.indexOf("--id");
  if (i < 0) return null;
  return Number(process.argv[i + 1]) || null;
})();
const IDS_ARG = (() => {
  const i = process.argv.indexOf("--ids");
  if (i < 0) return null;
  return process.argv[i + 1]
    .split(",")
    .map((s) => Number(s.trim()))
    .filter(Boolean);
})();

const MODELS_DIR = path.join(process.cwd(), "face-api-models");
const TARGET_ASPECT = 360 / 220;
const SCORE_TIE = 0.05;

async function loadModels() {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

async function bufferToTensor(buf) {
  const { data, info } = await sharp(buf)
    .rotate()
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`channels=${info.channels}`);
  return {
    tensor: tf.tensor3d(
      new Uint8Array(data),
      [info.height, info.width, 3],
      "int32",
    ),
    width: info.width,
    height: info.height,
  };
}

async function detectFace(buf) {
  const { tensor, width, height } = await bufferToTensor(buf);
  try {
    const dets = await faceapi.detectAllFaces(
      tensor,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
    );
    if (!dets.length) return null;
    // Confidence first, area as tiebreaker — see detect.ts for why.
    const sorted = [...dets].sort((a, b) => {
      if (Math.abs(a.score - b.score) > SCORE_TIE) return b.score - a.score;
      return b.box.width * b.box.height - a.box.width * a.box.height;
    });
    const best = sorted[0];
    return {
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

async function bakeHeadshot(buf, face, alumniId) {
  // Natural-scale crop: largest 1.64:1 letterbox that fits inside
  // the source, slid so the face is centered (clamped to bounds).
  // No pixel zoom — keeps tiny-face sources looking like the source.
  let cropW, cropH;
  if (face.imgW / face.imgH <= TARGET_ASPECT) {
    cropW = face.imgW;
    cropH = Math.round(cropW / TARGET_ASPECT);
  } else {
    cropH = face.imgH;
    cropW = Math.round(cropH * TARGET_ASPECT);
  }
  const cx = face.pixelX + face.pixelW / 2;
  const cy = face.pixelY + face.pixelH * 0.45;
  const left = clamp(Math.round(cx - cropW / 2), 0, face.imgW - cropW);
  const top = clamp(Math.round(cy - cropH / 2), 0, face.imgH - cropH);

  const out = await sharp(buf)
    .rotate()
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ width: 720, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const key = `alumni-headshots/${alumniId}.jpg`;
  const uploaded = await put(key, out, {
    access: "public",
    allowOverwrite: true,
    contentType: "image/jpeg",
  });
  return uploaded.url;
}

async function fetchTargets() {
  if (ID_ARG) {
    return sql`SELECT id, photo_url FROM alumni WHERE id = ${ID_ARG} AND photo_url IS NOT NULL`;
  }
  if (IDS_ARG && IDS_ARG.length) {
    return sql`SELECT id, photo_url FROM alumni WHERE id = ANY(${IDS_ARG}::int[]) AND photo_url IS NOT NULL ORDER BY id`;
  }
  return sql`SELECT id, photo_url FROM alumni WHERE photo_url IS NOT NULL AND photo_headshot_url IS NULL ORDER BY id`;
}

async function main() {
  console.log("loading models…");
  await loadModels();
  const targets = await fetchTargets();
  console.log(`${targets.length} alumni to process`);
  let ok = 0,
    none = 0,
    failed = 0;
  for (let i = 0; i < targets.length; i++) {
    const { id, photo_url } = targets[i];
    try {
      const res = await fetch(photo_url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const face = await detectFace(buf);
      if (!face) {
        await sql`UPDATE alumni SET photo_focal_x = NULL, photo_focal_y = NULL, photo_focal_at = NOW(), photo_headshot_url = NULL WHERE id = ${id}`;
        none++;
      } else {
        const url = await bakeHeadshot(buf, face, id);
        const focalX = Math.round(((face.pixelX + face.pixelW / 2) / face.imgW) * 100);
        const focalY = Math.round(((face.pixelY + face.pixelH * 0.45) / face.imgH) * 100);
        await sql`
          UPDATE alumni
             SET photo_focal_x = ${focalX},
                 photo_focal_y = ${focalY},
                 photo_focal_at = NOW(),
                 photo_headshot_url = ${url}
           WHERE id = ${id}
        `;
        ok++;
      }
    } catch (err) {
      console.error(`#${id} failed:`, err.message);
      failed++;
    }
    if ((i + 1) % 10 === 0 || i + 1 === targets.length) {
      process.stdout.write(`\r ${i + 1}/${targets.length} · ${ok} baked · ${none} no-face · ${failed} failed`);
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
