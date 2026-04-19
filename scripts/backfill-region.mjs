import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { cityToRegion } from "../lib/region.ts";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const rows = await sql.query(
  "SELECT id, current_city FROM alumni WHERE current_city IS NOT NULL AND trim(current_city) <> ''"
);

const counts = {};
let updated = 0;
for (const r of rows) {
  const region = cityToRegion(r.current_city);
  counts[region ?? "null"] = (counts[region ?? "null"] ?? 0) + 1;
  await sql.query("UPDATE alumni SET region = $1 WHERE id = $2", [region, r.id]);
  updated++;
}

console.log(`Updated ${updated} rows.`);
console.table(counts);
