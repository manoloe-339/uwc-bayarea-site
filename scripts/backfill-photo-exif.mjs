// Re-fetches each event_photos blob, extracts EXIF DateTimeOriginal, and
// writes it to the new taken_at column. Idempotent — only updates rows
// where taken_at is currently NULL. Safe to run repeatedly.
//
// Run after migration 051 has been applied.
//
//   node scripts/backfill-photo-exif.mjs           # process all rows
//   node scripts/backfill-photo-exif.mjs --limit 50 # cap (smoke test)

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import exifr from "exifr";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set — run `vercel env pull .env.local` first.");
  process.exit(1);
}
const sql = neon(url);

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null;

const rows = limit
  ? await sql`SELECT id, blob_url, original_filename FROM event_photos WHERE taken_at IS NULL ORDER BY id ASC LIMIT ${limit}`
  : await sql`SELECT id, blob_url, original_filename FROM event_photos WHERE taken_at IS NULL ORDER BY id ASC`;

console.log(`Backfilling EXIF for ${rows.length} photo(s) without taken_at`);

let extracted = 0;
let skipped = 0;
let errored = 0;

for (const r of rows) {
  try {
    const res = await fetch(r.blob_url);
    if (!res.ok) {
      console.warn(`  #${r.id} fetch failed: ${res.status}`);
      errored++;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const exif = await exifr.parse(buf, ["DateTimeOriginal", "CreateDate", "DateTime"]).catch(() => null);
    const d = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTime;
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      skipped++;
      continue;
    }
    const year = d.getUTCFullYear();
    if (year < 1990 || year > new Date().getUTCFullYear() + 1) {
      skipped++;
      continue;
    }
    await sql`UPDATE event_photos SET taken_at = ${d} WHERE id = ${r.id}`;
    extracted++;
    if (extracted % 25 === 0) {
      console.log(`  …${extracted} updated`);
    }
  } catch (err) {
    console.warn(`  #${r.id} error: ${err.message}`);
    errored++;
  }
}

console.log(`Done. extracted=${extracted} skipped(no exif)=${skipped} errored=${errored}`);
