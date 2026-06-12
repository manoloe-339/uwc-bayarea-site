/**
 * One-shot backfill: pull every ISO 3166-1 alpha-2 country flag from
 * Flagpedia (https://flagcdn.com) as SVG, re-host in our Vercel Blob,
 * and record the mapping in the `country_flags` table.
 *
 * Idempotent — re-running re-fetches (overwriting the blob and bumping
 * fetched_at), so it's safe to use to refresh after a flag update.
 * Pass --skip-existing to only pull codes that aren't already in the
 * table.
 *
 * Usage:
 *   node scripts/backfill-country-flags.mjs
 *   node scripts/backfill-country-flags.mjs --skip-existing
 *
 * Env: reads DATABASE_URL and BLOB_READ_WRITE_TOKEN from .env.local.
 */

import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import fs from "node:fs";

const env = fs.readFileSync("./.env.local", "utf8");
function envVar(name) {
  const m = env.match(new RegExp(`^${name}="([^"]+)"$`, "m"));
  if (!m) throw new Error(`missing ${name} in .env.local`);
  return m[1];
}
process.env.BLOB_READ_WRITE_TOKEN = envVar("BLOB_READ_WRITE_TOKEN");

const sql = neon(envVar("DATABASE_URL"));
const skipExisting = process.argv.includes("--skip-existing");

const CONCURRENCY = 10;
const CODES_URL = "https://flagcdn.com/en/codes.json";
const SVG_URL = (iso) => `https://flagcdn.com/${iso}.svg`;

/* ------------------------------------------------------------------ */

console.log("1/3 fetching Flagpedia ISO code list…");
const codesRes = await fetch(CODES_URL);
if (!codesRes.ok) {
  throw new Error(`codes fetch ${codesRes.status} ${codesRes.statusText}`);
}
const codesJson = await codesRes.json();
/** @type {Array<{iso: string, name: string}>} */
const all = Object.entries(codesJson)
  // Flagpedia also exposes ISO 3166-2 subdivision flags (gb-eng, us-ca, …)
  // which we don't need for the directory's origin-country lookup.
  .filter(([iso]) => /^[a-z]{2}$/i.test(iso))
  .map(([iso, name]) => ({ iso: iso.toLowerCase(), name }));
all.sort((a, b) => a.iso.localeCompare(b.iso));
console.log(`   ${all.length} country codes`);

let todo = all;
if (skipExisting) {
  const existing = new Set(
    (await sql`SELECT iso FROM country_flags`).map((r) => r.iso),
  );
  todo = all.filter((c) => !existing.has(c.iso));
  console.log(`   ${existing.size} already in DB · ${todo.length} to fetch`);
}

if (todo.length === 0) {
  console.log("nothing to do.");
  process.exit(0);
}

/* ------------------------------------------------------------------ */

console.log(`2/3 downloading + uploading (concurrency=${CONCURRENCY})…`);

let done = 0;
let failed = 0;
/** @type {Array<{iso: string, name: string, blobUrl: string}>} */
const successes = [];

async function rehost({ iso, name }) {
  try {
    const res = await fetch(SVG_URL(iso));
    if (!res.ok) {
      console.error(`\n   ${iso}: fetch ${res.status}`);
      failed++;
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const uploaded = await put(`country-flags/${iso}.svg`, buf, {
      access: "public",
      contentType: "image/svg+xml",
      allowOverwrite: true,
      // Stable key so the URL never changes between re-runs; the OS
      // cache + Vercel Image Optimization handle invalidation.
      addRandomSuffix: false,
    });
    successes.push({ iso, name, blobUrl: uploaded.url });
  } catch (err) {
    console.error(`\n   ${iso}: ${err?.message ?? err}`);
    failed++;
  } finally {
    done++;
    if (done % 10 === 0 || done === todo.length) {
      const pct = ((done / todo.length) * 100).toFixed(1);
      process.stdout.write(
        `\r   ${done}/${todo.length} (${pct}%, ${failed} failed)`,
      );
    }
  }
}

async function worker(slice) {
  for (const item of slice) await rehost(item);
}

const slices = Array.from({ length: CONCURRENCY }, () => []);
todo.forEach((c, i) => slices[i % CONCURRENCY].push(c));
await Promise.all(slices.map(worker));
process.stdout.write("\n");

/* ------------------------------------------------------------------ */

console.log(`3/3 upserting ${successes.length} rows…`);
for (const { iso, name, blobUrl } of successes) {
  await sql`
    INSERT INTO country_flags (iso, name, blob_url, source, fetched_at)
    VALUES (${iso}, ${name}, ${blobUrl}, 'flagpedia', NOW())
    ON CONFLICT (iso) DO UPDATE SET
      name = EXCLUDED.name,
      blob_url = EXCLUDED.blob_url,
      source = EXCLUDED.source,
      fetched_at = EXCLUDED.fetched_at
  `;
}
console.log("done.");
