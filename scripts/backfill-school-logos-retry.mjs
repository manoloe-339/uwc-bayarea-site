/**
 * Retry pass for schools still missing school_logo_url. Simplifies the
 * school name by trimming trailing modifiers (Law School, Business School,
 * dash-suffixes, parentheticals) and re-running brand search.
 */
import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const env = fs.readFileSync('./.env.local', 'utf8');
const dbUrl = env.match(/^DATABASE_URL="([^"]+)"/m)[1];
const pubKey = env.match(/^NEXT_PUBLIC_LOGO_DEV_KEY=([^\n"]+)/m)[1].trim();
const secretKey = env.match(/^LOGO_DEV_SECRET_KEY=([^\n"]+)/m)[1].trim();
const sql = neon(dbUrl);

const PLACEHOLDER_MAX_BYTES = 700;

async function searchBrand(query) {
  const res = await fetch(`https://api.logo.dev/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
async function logoSize(domain) {
  const res = await fetch(`https://img.logo.dev/${encodeURIComponent(domain)}?token=${pubKey}&size=128&format=png`);
  if (!res.ok) return 0;
  return (await res.arrayBuffer()).byteLength;
}

function simplify(name) {
  let s = name.trim();
  // Drop parentheticals.
  s = s.replace(/\([^)]*\)/g, ' ');
  // Drop trailing " - X" / " — X" / " | X".
  s = s.replace(/[-–—|]\s*[^-–—|]+$/, ' ');
  // Drop trailing " , X" descriptor.
  s = s.replace(/,\s*[^,]+$/, ' ');
  // Drop common sub-unit suffixes.
  s = s.replace(/\b(Law|Business|Medical|Engineering|Public Policy|Public Health|Graduate)\s+School\b/i, ' ');
  s = s.replace(/\b(School of|College of|Institute of|Department of)\s+[A-Z][a-zA-Z& ]+$/, ' ');
  s = s.replace(/\bSchool\b\s*$/, ' ');
  s = s.replace(/\bGlobal Scholars\b/i, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const schools = await sql`
  SELECT DISTINCT school
  FROM alumni_education
  WHERE school_logo_url IS NULL
    AND school IS NOT NULL AND TRIM(school) <> ''
  ORDER BY school
`;
console.log(`Retrying ${schools.length} schools with simplified names.`);

let resolved = 0;
for (const s of schools) {
  const name = s.school.trim();
  const simpler = simplify(name);
  if (!simpler || simpler === name) continue;
  const results = await searchBrand(simpler);
  if (!results.length) continue;
  let winner = null;
  for (const r of results.slice(0, 3)) {
    const sz = await logoSize(r.domain);
    if (sz > PLACEHOLDER_MAX_BYTES) { winner = { domain: r.domain, bytes: sz }; break; }
  }
  if (!winner) continue;
  const url = `https://img.logo.dev/${encodeURIComponent(winner.domain)}?token=${pubKey}&size=128&format=png`;
  await sql`UPDATE alumni_education SET school_logo_url = ${url}
            WHERE school_logo_url IS NULL AND school = ${name}`;
  resolved++;
  console.log(`  ✓ ${name}  -> simplified "${simpler}" -> ${winner.domain}`);
}

const after = await sql`
  SELECT COUNT(*)::int AS total, COUNT(school_logo_url)::int AS with_logo
  FROM alumni_education
`;
console.log(`\nRetry resolved ${resolved}. Coverage now ${after[0].with_logo}/${after[0].total}.`);
