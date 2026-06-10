import { neon } from '@neondatabase/serverless';
import fs from 'fs';
const env = fs.readFileSync('./.env.local', 'utf8');
const sql = neon(env.match(/^DATABASE_URL="([^"]+)"/m)[1]);
const a = await sql`SELECT id, first_name, last_name, photo_url FROM alumni WHERE id = 99`;
console.log(a[0]);
const isLogo = await sql`
  SELECT 'school' AS src, school FROM alumni_education WHERE school_logo_url = ${a[0].photo_url} LIMIT 3
  UNION ALL
  SELECT 'current_company', current_company FROM alumni WHERE current_company_logo_url = ${a[0].photo_url} LIMIT 3
  UNION ALL
  SELECT 'career', company FROM alumni_career WHERE company_logo_url = ${a[0].photo_url} LIMIT 3
`;
console.log("This photo_url is also used as a logo in:");
for (const r of isLogo) console.log(" ", r);
