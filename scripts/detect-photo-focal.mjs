/**
 * One-time face-detection pass over alumni.photo_url. For each alum
 * with a photo, find the dominant face, compute its center as
 * percentage coordinates of the source image, and write them back to
 * the new photo_focal_x / photo_focal_y / photo_focal_at columns. The
 * UI uses these to set `object-position` on the rendered <img> so
 * heads don't get cropped off the top of the directory card band.
 *
 * Idempotent: skips alumni that already have a focal value unless
 * --reprocess is passed.
 *
 *   node scripts/detect-photo-focal.mjs            # only un-baked
 *   node scripts/detect-photo-focal.mjs --reprocess  # everyone
 *   node scripts/detect-photo-focal.mjs --id 145    # one alum
 *
 * Env: reads DATABASE_URL from .env.local.
 */

import { neon } from "@neondatabase/serverless";
// tfjs-node 4.22 uses util.isNullOrUndefined which Node 24 removed.
// ESM namespaces are frozen, so we have to reach in via CJS to
// patch the actual util module object before tfjs-node touches it.
import { createRequire } from "node:module";
const __require = createRequire(import.meta.url);
const __util = __require("util");
if (typeof __util.isNullOrUndefined !== "function") {
  __util.isNullOrUndefined = (v) => v === null || v === undefined;
}
import * as tf from "@tensorflow/tfjs-node";
import * as faceapi from "@vladmandic/face-api";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Read DATABASE_URL from process.env first (CI / GitHub Actions
// secrets, Vercel dashboard env, etc.) and fall back to .env.local
// for plain local invocations.
function envVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync("./.env.local", "utf8");
    const m = env.match(new RegExp(`^${name}="([^"]+)"$`, "m"));
    if (m) return m[1];
  } catch {
    // .env.local absent — fall through.
  }
  throw new Error(`missing ${name} (process.env or .env.local)`);
}
const sql = neon(envVar("DATABASE_URL"));

// ---- args
const REPROCESS = process.argv.includes("--reprocess");
const ID_ARG = (() => {
  const i = process.argv.indexOf("--id");
  if (i < 0) return null;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : null;
})();
const MIN_ARG = (() => {
  const i = process.argv.indexOf("--min");
  if (i < 0) return null;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
})();

// ---- face-api model loading
const MODELS_DIR = path.join(process.cwd(), ".face-api-models");
const MODEL_CDN =
  "https://raw.githubusercontent.com/vladmandic/face-api/master/model/";
// SSD MobileNet is heavy but the most reliable face detector in the
// face-api set. ~5 MB of weights split across the manifest and 4
// shards.
const MODEL_FILES = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model.bin",
];

async function ensureModelsCached() {
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR);
  for (const file of MODEL_FILES) {
    const dest = path.join(MODELS_DIR, file);
    if (fs.existsSync(dest)) continue;
    process.stdout.write(`  downloading ${file}… `);
    const res = await fetch(MODEL_CDN + file);
    if (!res.ok) {
      throw new Error(`fetch ${file}: ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log(`${buf.length} bytes`);
  }
}

async function loadModels() {
  console.log("1/3 ensuring face-api models are cached…");
  await ensureModelsCached();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
  // tfjs-node defaults to CPU; faster + no GPU setup.
}

async function fetchImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo fetch ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Convert a sharp-decoded image to a 3-channel uint8 tensor that
 * face-api can ingest. Forces sRGB + drops alpha explicitly so a
 * grayscale or RGBA input still arrives as RGB. */
async function bufferToTensor(buf) {
  const { data, info } = await sharp(buf)
    .rotate() // honour EXIF orientation
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

/** Returns {x, y} as 0..100 ints, or null if no face found. */
async function detectFocal(buf) {
  const { tensor, width, height } = await bufferToTensor(buf);
  try {
    const options = new faceapi.SsdMobilenetv1Options({
      minConfidence: 0.5,
    });
    const detections = await faceapi.detectAllFaces(tensor, options);
    if (!detections || detections.length === 0) return null;
    // Pick the largest face — handles group photos by zooming on the
    // most prominent person, which is usually the subject.
    let best = detections[0];
    let bestArea = best.box.width * best.box.height;
    for (const d of detections.slice(1)) {
      const a = d.box.width * d.box.height;
      if (a > bestArea) {
        best = d;
        bestArea = a;
      }
    }
    // Center the focal point a touch ABOVE the face center so the
    // composition reads as "head + a sliver of neck/shoulder" rather
    // than "face dead-centered" — better for portrait crops.
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

function clampPercent(v) {
  const n = Math.round(v);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

async function fetchTargets() {
  if (ID_ARG) {
    return sql`
      SELECT id, photo_url
      FROM alumni
      WHERE id = ${ID_ARG} AND photo_url IS NOT NULL
    `;
  }
  if (REPROCESS) {
    return sql`
      SELECT id, photo_url
      FROM alumni
      WHERE photo_url IS NOT NULL
      ORDER BY id
    `;
  }
  // Default: anything we've never examined. `photo_focal_at IS NULL`
  // is the right predicate because no-face rows are also marked with
  // a timestamp — without it the script would re-process them every
  // run.
  return sql`
    SELECT id, photo_url
    FROM alumni
    WHERE photo_url IS NOT NULL
      AND photo_focal_at IS NULL
    ORDER BY id
  `;
}

async function main() {
  // When --min is set, count first and bail BEFORE loading the
  // ~5.6 MB models or hitting tfjs init — keeps the cron lightweight
  // when there's nothing to do.
  if (MIN_ARG != null && !ID_ARG && !REPROCESS) {
    const pending = (await sql`
      SELECT COUNT(*)::int AS n FROM alumni
       WHERE photo_url IS NOT NULL AND photo_focal_at IS NULL
    `)[0]?.n ?? 0;
    if (pending < MIN_ARG) {
      console.log(
        `pending=${pending}, threshold=${MIN_ARG} — below threshold, skipping.`,
      );
      return;
    }
    console.log(`pending=${pending} ≥ threshold=${MIN_ARG} — running.`);
  }

  await loadModels();

  console.log("2/3 collecting alumni to process…");
  const targets = await fetchTargets();
  console.log(`   ${targets.length} alumni`);
  if (targets.length === 0) {
    console.log("nothing to do.");
    return;
  }

  console.log("3/3 detecting…");
  let ok = 0;
  let noFace = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < targets.length; i++) {
    const { id, photo_url } = targets[i];
    try {
      const buf = await fetchImage(photo_url);
      const focal = await detectFocal(buf);
      if (focal) {
        await sql`
          UPDATE alumni
             SET photo_focal_x = ${focal.x},
                 photo_focal_y = ${focal.y},
                 photo_focal_at = NOW()
           WHERE id = ${id}
        `;
        ok++;
      } else {
        // Mark as processed so we don't retry every run, but leave
        // the x/y NULL so the UI falls back to its default.
        await sql`
          UPDATE alumni
             SET photo_focal_x = NULL,
                 photo_focal_y = NULL,
                 photo_focal_at = NOW()
           WHERE id = ${id}
        `;
        noFace++;
      }
    } catch (err) {
      failed++;
      failures.push({ id, err: err?.message ?? String(err) });
    }
    if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
      const pct = (((i + 1) / targets.length) * 100).toFixed(1);
      process.stdout.write(
        `\r   ${i + 1}/${targets.length} (${pct}%) · ${ok} faces · ${noFace} none · ${failed} failed`,
      );
    }
  }
  process.stdout.write("\n");

  console.log(
    `done. faces: ${ok} · no-face: ${noFace} · failed: ${failed}`,
  );
  if (failures.length > 0) {
    console.log("first 10 failures:");
    for (const f of failures.slice(0, 10)) {
      console.log(`  ${f.id}: ${f.err}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
