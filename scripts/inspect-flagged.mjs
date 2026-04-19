import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);
const flagged = await sql.query(
  "SELECT email, uwc_college_raw, uwc_college, grad_year_raw, grad_year, flags FROM alumni WHERE array_length(flags,1)>0"
);
console.table(flagged);
const total = await sql.query("SELECT COUNT(*)::int AS n FROM alumni");
console.log("total rows:", total[0].n);
