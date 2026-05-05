import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set — run `vercel env pull .env.local` first.");
  process.exit(1);
}

const sql = neon(url);
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

async function ensureTrackingTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function appliedSet() {
  const rows = await sql`SELECT filename FROM _migrations`;
  return new Set(rows.map((r) => r.filename));
}

async function applyOne(file) {
  const body = readFileSync(join(dir, file), "utf8");
  process.stdout.write(`applying ${file}… `);
  const statements = body.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  await sql`INSERT INTO _migrations (filename) VALUES (${file}) ON CONFLICT DO NOTHING`;
  console.log("ok");
}

if (process.argv.includes("--bootstrap")) {
  // One-time use when introducing the tracker on a database that's
  // already had every migration applied. Marks all files in migrations/
  // as applied without re-running their statements. Safe to re-run; uses
  // ON CONFLICT DO NOTHING.
  await ensureTrackingTable();
  for (const file of files) {
    await sql`INSERT INTO _migrations (filename) VALUES (${file}) ON CONFLICT DO NOTHING`;
  }
  console.log(`bootstrap complete — marked ${files.length} files as applied`);
  process.exit(0);
}

await ensureTrackingTable();
const applied = await appliedSet();
let n = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  await applyOne(file);
  n++;
}
console.log(`migrations complete — ${n} applied this run, ${applied.size + n} total`);
