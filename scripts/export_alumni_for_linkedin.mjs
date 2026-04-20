import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set — run `vercel env pull .env.local` first.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "alumni_export.json");

const rows = await sql`
  SELECT id, first_name, last_name, email, uwc_college, grad_year, current_city, company
  FROM alumni
  WHERE linkedin_url IS NULL
    AND subscribed = true
  ORDER BY id
`;

writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf8");

console.log(`Exported ${rows.length} alumni to ${outPath}`);
if (rows.length > 0) {
  console.log(
    `Sample: #${rows[0].id} ${[rows[0].first_name, rows[0].last_name].filter(Boolean).join(" ") || "(no name)"} · ${rows[0].email}`
  );
}
