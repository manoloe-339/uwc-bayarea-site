/**
 * One-shot seed for login_assets: top 10 companies + top 10 non-UWC
 * universities from the directory data. Each row uses the existing
 * LinkedIn-derived logo URL as a starting point — the admin can
 * then crop / zoom / replace any of them via /admin/tools/login-assets.
 *
 * Idempotent: skips rows where the (kind, label) pair already exists.
 *
 * Usage: node scripts/seed-login-assets.mjs
 */

import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

const env = fs.readFileSync("./.env.local", "utf8");
const DB = env.match(/^DATABASE_URL="([^"]+)"/m)[1];
const sql = neon(DB);

console.log("1/3 fetching top 10 companies by alumni count…");
const companies = await sql`
  SELECT current_company AS label,
         MAX(current_company_logo_url) AS image_url,
         COUNT(*)::int AS n
  FROM alumni
  WHERE current_company IS NOT NULL
    AND current_company_logo_url IS NOT NULL
    AND affiliation ILIKE '%alum%'
    AND deceased IS NOT TRUE
    AND moved_out IS NOT TRUE
  GROUP BY current_company
  ORDER BY n DESC, current_company ASC
  LIMIT 10
`;
for (const c of companies) console.log(`  ${c.n}\t${c.label}`);

console.log("\n2/3 fetching top 10 non-UWC universities by distinct alumni…");
const unis = await sql`
  SELECT e.school AS label,
         MAX(e.school_logo_url) AS image_url,
         COUNT(DISTINCT a.id)::int AS n
  FROM alumni_education e
  JOIN alumni a ON a.id = e.alumni_id
  WHERE e.is_uwc IS NOT TRUE
    AND e.school IS NOT NULL
    AND e.school_logo_url IS NOT NULL
    AND a.affiliation ILIKE '%alum%'
    AND a.deceased IS NOT TRUE
    AND a.moved_out IS NOT TRUE
  GROUP BY e.school
  ORDER BY n DESC, e.school ASC
  LIMIT 10
`;
for (const u of unis) console.log(`  ${u.n}\t${u.label}`);

console.log("\n3/3 upserting into login_assets…");
let inserted = 0;
let skipped = 0;

const seed = async (kind, rows) => {
  for (const r of rows) {
    if (!r.image_url) continue;
    const existing = await sql`
      SELECT id FROM login_assets WHERE kind = ${kind} AND label = ${r.label}
    `;
    if (existing.length > 0) {
      skipped++;
      console.log(`  skip (already exists): ${kind} / ${r.label}`);
      continue;
    }
    await sql`
      INSERT INTO login_assets (kind, label, image_url)
      VALUES (${kind}, ${r.label}, ${r.image_url})
    `;
    inserted++;
    console.log(`  add:                    ${kind} / ${r.label}`);
  }
};

await seed("company_logo", companies);
await seed("university_logo", unis);

console.log(`\ndone. inserted=${inserted} skipped=${skipped}`);
