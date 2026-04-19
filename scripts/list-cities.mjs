import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);

const rows = await sql.query(
  `SELECT lower(trim(current_city)) AS city, COUNT(*)::int AS n
   FROM alumni
   WHERE current_city IS NOT NULL AND trim(current_city) <> ''
   GROUP BY lower(trim(current_city))
   ORDER BY n DESC`
);

for (const r of rows) {
  console.log(`${r.n.toString().padStart(4)}  ${r.city}`);
}
console.log(`\n${rows.length} distinct city strings`);
