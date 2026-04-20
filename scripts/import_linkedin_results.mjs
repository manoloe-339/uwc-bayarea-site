import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config } from "dotenv";

config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// CLI args
//   (no args)           → load linkedin_results.json, split by confidence,
//                         import high-confidence rows, write rest to
//                         review_needed.json.
//   --review <file>     → load <file>, import only rows with approved=true.
//   --yes               → skip the interactive confirmation prompt.
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const autoApprove = args.includes("--yes");
const reviewIdx = args.indexOf("--review");
const reviewFile = reviewIdx >= 0 ? args[reviewIdx + 1] : null;

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const resultsPath = reviewFile
  ? join(projectRoot, reviewFile)
  : join(projectRoot, "linkedin_results.json");
const reviewOutPath = join(projectRoot, "review_needed.json");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set — run `vercel env pull .env.local` first.");
  process.exit(1);
}

if (!existsSync(resultsPath)) {
  console.error(`Input file not found: ${resultsPath}`);
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ---------------------------------------------------------------------------
// Load + normalize input rows. Each entry may have:
//   neon_id, email, first_name, last_name, uwc_college, grad_year,
//   li_candidates, chosen_url, confidence, reasoning, approved
// ---------------------------------------------------------------------------

let raw;
try {
  raw = JSON.parse(readFileSync(resultsPath, "utf8"));
} catch (err) {
  console.error(`Failed to parse ${resultsPath}:`, err.message);
  process.exit(1);
}
if (!Array.isArray(raw)) {
  console.error(`Expected an array in ${resultsPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Figure out which rows to UPDATE and which to write out for review.
// ---------------------------------------------------------------------------

function isHighConfidence(row) {
  return String(row.confidence ?? "").toLowerCase() === "high";
}

let toImport;
let toReview = [];

if (reviewFile) {
  toImport = raw.filter((r) => r.approved === true);
  const skipped = raw.length - toImport.length;
  console.log(`Review mode: ${toImport.length} approved, ${skipped} not approved.`);
} else {
  toImport = raw.filter(isHighConfidence);
  toReview = raw.filter((r) => !isHighConfidence(r));
}

// ---------------------------------------------------------------------------
// Dedupe + validate the import set. Skip rows that are missing neon_id or
// chosen_url. Count alumni rows whose linkedin_url is already set (those we
// won't touch — preserves any manual edits by the alumni themselves).
// ---------------------------------------------------------------------------

const seen = new Set();
const invalid = [];
const dedupedImports = [];
for (const r of toImport) {
  if (typeof r.neon_id !== "number" || !r.chosen_url) {
    invalid.push(r);
    continue;
  }
  if (seen.has(r.neon_id)) continue;
  seen.add(r.neon_id);
  dedupedImports.push(r);
}

// Look up which of these already have a linkedin_url on file.
let alreadySetIds = new Set();
if (dedupedImports.length > 0) {
  const ids = dedupedImports.map((r) => r.neon_id);
  const rows = await sql.query(
    `SELECT id FROM alumni WHERE id = ANY($1) AND linkedin_url IS NOT NULL`,
    [ids]
  );
  alreadySetIds = new Set(rows.map((r) => r.id));
}
const willUpdate = dedupedImports.filter((r) => !alreadySetIds.has(r.neon_id));

// ---------------------------------------------------------------------------
// Summary + confirm.
// ---------------------------------------------------------------------------

function summarize(all) {
  const counts = { high: 0, medium: 0, low: 0, other: 0 };
  for (const r of all) {
    const c = String(r.confidence ?? "other").toLowerCase();
    if (counts[c] != null) counts[c]++;
    else counts.other++;
  }
  return counts;
}

const inputCounts = summarize(raw);

console.log("");
console.log("─── LinkedIn import summary ───");
console.log(`  Input file        : ${resultsPath}`);
console.log(`  Total in file     : ${raw.length}`);
if (!reviewFile) {
  console.log(`    high            : ${inputCounts.high}`);
  console.log(`    medium          : ${inputCounts.medium}`);
  console.log(`    low             : ${inputCounts.low}`);
  if (inputCounts.other) console.log(`    other/unknown   : ${inputCounts.other}`);
}
console.log(`  Will UPDATE       : ${willUpdate.length}`);
console.log(`  Already set, skip : ${alreadySetIds.size}`);
if (invalid.length) console.log(`  Invalid (skipped) : ${invalid.length}`);
if (!reviewFile) {
  console.log(`  To review_needed  : ${toReview.length} (medium + low)`);
}
console.log("");

if (willUpdate.length === 0 && toReview.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

// Write the review file BEFORE prompting so the admin has the list on disk
// even if they bail on the UPDATE step.
if (!reviewFile && toReview.length > 0) {
  writeFileSync(reviewOutPath, JSON.stringify(toReview, null, 2), "utf8");
  console.log(`Wrote ${toReview.length} rows to ${reviewOutPath}.`);
  console.log("");
  console.log("To approve items from review_needed.json:");
  console.log("  1. Open review_needed.json");
  console.log("  2. Add 'approved': true to each item you want to import");
  console.log("  3. Save as review_approved.json");
  console.log("  4. Run: node scripts/import_linkedin_results.mjs --review review_approved.json");
  console.log("");
}

if (willUpdate.length === 0) {
  console.log("No rows to import right now. Done.");
  process.exit(0);
}

if (!autoApprove) {
  const rl = createInterface({ input: stdin, output: stdout });
  const ans = (await rl.question(`Import ${willUpdate.length} row(s)? [y/n] `)).trim().toLowerCase();
  rl.close();
  if (ans !== "y" && ans !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// Do the updates.
// ---------------------------------------------------------------------------

let updated = 0;
let failed = 0;
for (const r of willUpdate) {
  const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || "(no name)";
  try {
    const result = await sql.query(
      `UPDATE alumni
       SET linkedin_url = $1, updated_at = NOW()
       WHERE id = $2 AND linkedin_url IS NULL
       RETURNING id`,
      [r.chosen_url, r.neon_id]
    );
    if (result.length === 1) {
      console.log(`✓ #${r.neon_id} ${name} → ${r.chosen_url}`);
      updated++;
    } else {
      // Someone set it between our earlier lookup and now — skip quietly.
      console.log(`− #${r.neon_id} ${name} (already set, skipped)`);
    }
  } catch (err) {
    console.error(`✗ #${r.neon_id} ${name} failed: ${err.message}`);
    failed++;
  }
}

console.log("");
console.log(`Done. Updated ${updated}, failed ${failed}.`);
