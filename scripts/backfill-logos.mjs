/**
 * One-shot backfill: re-host every LinkedIn-served logo URL referenced
 * by the DB to our own Vercel Blob storage, then rewrite the rows so
 * they point at the blob URLs.
 *
 * Tables touched:
 *   - alumni.current_company_logo_url
 *   - alumni_education.school_logo_url
 *   - alumni_career.company_logo_url
 *
 * Strategy:
 *   1. Collect the union of distinct LinkedIn URLs across all three.
 *   2. For each unique URL: download → upload to Vercel Blob → record
 *      the mapping. Concurrency is capped so we don't open hundreds of
 *      sockets to LinkedIn at once.
 *   3. UPDATE each table to replace `source` with `blob` for every
 *      mapped URL. Rows with URLs that failed to re-host are left
 *      alone (better than nulling — the LinkedIn link still works in
 *      the short term).
 *
 * Idempotent: rerunning will skip URLs already self-hosted.
 *
 * Usage:
 *   node scripts/backfill-logos.mjs
 *
 * Env: reads DATABASE_URL and BLOB_READ_WRITE_TOKEN from .env.local.
 */

import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

const env = fs.readFileSync("./.env.local", "utf8");
function envVar(name) {
  const m = env.match(new RegExp(`^${name}="([^"]+)"$`, "m"));
  if (!m) throw new Error(`missing ${name} in .env.local`);
  return m[1];
}
process.env.BLOB_READ_WRITE_TOKEN = envVar("BLOB_READ_WRITE_TOKEN");

const sql = neon(envVar("DATABASE_URL"));
const { rehostLogo } = await import("../lib/enrichment/logo-uploader.ts");

const CONCURRENCY = 8;

const SQL_LIKE = "https://media.licdn.com/%";

/* ------------------------------------------------------------------ */

console.log("1/4 collecting distinct LinkedIn-served URLs…");
const rows = await sql`
  SELECT url FROM (
    SELECT school_logo_url AS url       FROM alumni_education WHERE school_logo_url       LIKE ${SQL_LIKE}
    UNION
    SELECT current_company_logo_url     FROM alumni            WHERE current_company_logo_url LIKE ${SQL_LIKE}
    UNION
    SELECT company_logo_url             FROM alumni_career     WHERE company_logo_url      LIKE ${SQL_LIKE}
  ) u
`;
const urls = rows.map((r) => r.url);
console.log(`   ${urls.length} unique URLs`);

/* ------------------------------------------------------------------ */

console.log(`2/4 re-hosting (concurrency=${CONCURRENCY})…`);
/** @type {Map<string, string|null>} */
const map = new Map();
let done = 0;
let failed = 0;

async function worker(slice) {
  for (const url of slice) {
    const blob = await rehostLogo(url);
    map.set(url, blob);
    done++;
    if (!blob) failed++;
    if (done % 25 === 0 || done === urls.length) {
      const pct = ((done / urls.length) * 100).toFixed(1);
      process.stdout.write(`\r   ${done}/${urls.length} (${pct}%, ${failed} failed)`);
    }
  }
}

// Round-robin distribute urls across CONCURRENCY workers.
const buckets = Array.from({ length: CONCURRENCY }, () => []);
urls.forEach((u, i) => buckets[i % CONCURRENCY].push(u));
await Promise.all(buckets.map(worker));
process.stdout.write("\n");
console.log(`   done. ${urls.length - failed} re-hosted, ${failed} failed`);

/* ------------------------------------------------------------------ */

console.log("3/4 rewriting DB rows…");
let eduUpdated = 0;
let alumniUpdated = 0;
let careerUpdated = 0;

const entries = Array.from(map.entries()).filter(([, blob]) => !!blob);
for (let i = 0; i < entries.length; i++) {
  const [source, blob] = entries[i];
  // Three separate UPDATEs per URL keep each statement focused and
  // small. Could be batched into a temp table for higher throughput
  // but 2k URLs × 3 tables = ~6k statements over a few minutes is
  // fine for a one-shot backfill.
  const eduRes = await sql`
    UPDATE alumni_education SET school_logo_url = ${blob}
    WHERE school_logo_url = ${source}
  `;
  const alumRes = await sql`
    UPDATE alumni SET current_company_logo_url = ${blob}
    WHERE current_company_logo_url = ${source}
  `;
  const careerRes = await sql`
    UPDATE alumni_career SET company_logo_url = ${blob}
    WHERE company_logo_url = ${source}
  `;
  eduUpdated   += eduRes?.length    ?? eduRes?.rowCount    ?? 0;
  alumniUpdated += alumRes?.length  ?? alumRes?.rowCount   ?? 0;
  careerUpdated += careerRes?.length ?? careerRes?.rowCount ?? 0;
  if ((i + 1) % 50 === 0 || i + 1 === entries.length) {
    const pct = (((i + 1) / entries.length) * 100).toFixed(1);
    process.stdout.write(`\r   ${i + 1}/${entries.length} (${pct}%)`);
  }
}
process.stdout.write("\n");
console.log(`   edu rows updated:    ${eduUpdated}`);
console.log(`   alumni rows updated: ${alumniUpdated}`);
console.log(`   career rows updated: ${careerUpdated}`);

/* ------------------------------------------------------------------ */

console.log("4/4 verifying remaining LinkedIn URLs in DB…");
const remaining = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM alumni_education WHERE school_logo_url       LIKE ${SQL_LIKE}) AS edu,
    (SELECT COUNT(*)::int FROM alumni            WHERE current_company_logo_url LIKE ${SQL_LIKE}) AS alumni,
    (SELECT COUNT(*)::int FROM alumni_career     WHERE company_logo_url      LIKE ${SQL_LIKE}) AS career
`;
console.log("   still pointing at media.licdn.com:", remaining[0]);
console.log("\nbackfill complete.");
