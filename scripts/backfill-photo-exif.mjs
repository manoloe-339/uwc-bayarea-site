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

function isValidDate(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  if (year < 1990 || year > new Date().getUTCFullYear() + 1) return false;
  return true;
}

function extractDateFromFilename(filename) {
  if (!filename) return null;
  const dashed = filename.match(
    /(\d{4})-(\d{2})-(\d{2})(?:[\s_T]+(?:at\s+)?(\d{2})[.:](\d{2})(?:[.:](\d{2}))?)?/
  );
  if (dashed) {
    const [, y, m, d, hh, mm, ss] = dashed;
    const date = new Date(
      Date.UTC(
        Number(y),
        Number(m) - 1,
        Number(d),
        hh ? Number(hh) : 12,
        mm ? Number(mm) : 0,
        ss ? Number(ss) : 0
      )
    );
    if (isValidDate(date)) return date;
  }
  const compact = filename.match(/(\d{4})(\d{2})(\d{2})(?:[_-](\d{2})(\d{2})(\d{2}))?/);
  if (compact) {
    const [, y, m, d, hh, mm, ss] = compact;
    const yearNum = Number(y);
    if (yearNum >= 1990 && yearNum <= new Date().getUTCFullYear() + 1) {
      const date = new Date(
        Date.UTC(
          yearNum,
          Number(m) - 1,
          Number(d),
          hh ? Number(hh) : 12,
          mm ? Number(mm) : 0,
          ss ? Number(ss) : 0
        )
      );
      if (isValidDate(date) && Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
        return date;
      }
    }
  }
  return null;
}

const rows = limit
  ? await sql`SELECT id, blob_url, original_filename FROM event_photos WHERE taken_at IS NULL ORDER BY id ASC LIMIT ${limit}`
  : await sql`SELECT id, blob_url, original_filename FROM event_photos WHERE taken_at IS NULL ORDER BY id ASC`;

console.log(`Backfilling EXIF/filename date for ${rows.length} photo(s) without taken_at`);

let extracted = 0;
let fromFilename = 0;
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
    let d = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTime;
    let source = "exif";
    if (!isValidDate(d)) {
      d = extractDateFromFilename(r.original_filename);
      source = "filename";
    }
    if (!isValidDate(d)) {
      skipped++;
      continue;
    }
    await sql`UPDATE event_photos SET taken_at = ${d} WHERE id = ${r.id}`;
    if (source === "exif") extracted++;
    else fromFilename++;
    if ((extracted + fromFilename) % 25 === 0) {
      console.log(`  …${extracted + fromFilename} updated (${extracted} EXIF, ${fromFilename} filename)`);
    }
  } catch (err) {
    console.warn(`  #${r.id} error: ${err.message}`);
    errored++;
  }
}

console.log(
  `Done. exif=${extracted} filename=${fromFilename} skipped=${skipped} errored=${errored}`
);
