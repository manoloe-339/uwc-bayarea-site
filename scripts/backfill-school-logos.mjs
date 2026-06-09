/**
 * For every distinct alumni_education school without school_logo_url,
 * query Logo.dev brand search to find the real domain, validate that
 * the returned domain's logo isn't a generic placeholder (by size),
 * and write the resulting img.logo.dev URL back into the DB.
 *
 * Idempotent — only updates rows where school_logo_url IS NULL.
 *
 * Run with:  node scripts/backfill-school-logos.mjs
 */
import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const env = fs.readFileSync('./.env.local', 'utf8');
const dbUrl = env.match(/^DATABASE_URL="([^"]+)"/m)[1];
const pubKey = env.match(/^NEXT_PUBLIC_LOGO_DEV_KEY=([^\n"]+)/m)[1].trim();
const secretKey = env.match(/^LOGO_DEV_SECRET_KEY=([^\n"]+)/m)[1].trim();
const sql = neon(dbUrl);

const PLACEHOLDER_MAX_BYTES = 700; // empirically, real logos are usually >2KB
                                   // and placeholders are ~419-652 bytes.

async function searchBrand(query) {
  const u = `https://api.logo.dev/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function logoSize(domain) {
  const u = `https://img.logo.dev/${encodeURIComponent(domain)}?token=${pubKey}&size=128&format=png`;
  const res = await fetch(u, { method: 'GET' });
  if (!res.ok) return 0;
  const buf = await res.arrayBuffer();
  return buf.byteLength;
}

const schools = await sql`
  SELECT DISTINCT school, school_linkedin_url
  FROM alumni_education
  WHERE school_logo_url IS NULL
    AND school IS NOT NULL AND TRIM(school) <> ''
  ORDER BY school
`;
console.log(`Found ${schools.length} distinct schools to resolve.`);

let resolved = 0, missed = 0, updated_rows = 0;
const cache = new Map(); // school name -> winning domain or null

for (const s of schools) {
  const name = s.school.trim();
  if (cache.has(name)) continue;

  const results = await searchBrand(name);
  if (results.length === 0) {
    cache.set(name, null);
    missed++;
    console.log(`  ✗ ${name}  (no search hits)`);
    continue;
  }
  // Pick the first non-placeholder result.
  let winner = null;
  for (const r of results.slice(0, 3)) {
    const sz = await logoSize(r.domain);
    if (sz > PLACEHOLDER_MAX_BYTES) {
      winner = { domain: r.domain, bytes: sz };
      break;
    }
  }
  if (!winner) {
    cache.set(name, null);
    missed++;
    console.log(`  ✗ ${name}  (all candidates were placeholders)`);
    continue;
  }
  cache.set(name, winner.domain);
  resolved++;
  const url = `https://img.logo.dev/${encodeURIComponent(winner.domain)}?token=${pubKey}&size=128&format=png`;
  const upd = await sql`
    UPDATE alumni_education SET school_logo_url = ${url}
    WHERE school_logo_url IS NULL AND school = ${name}
  `;
  console.log(`  ✓ ${name}  -> ${winner.domain}  (${winner.bytes}b, +${upd.length ?? upd.rowCount ?? '?'} rows)`);
}

const after = await sql`
  SELECT COUNT(*)::int AS total, COUNT(school_logo_url)::int AS with_logo
  FROM alumni_education
`;
console.log(`\nResolved ${resolved}, missed ${missed}. Coverage now ${after[0].with_logo}/${after[0].total}.`);
