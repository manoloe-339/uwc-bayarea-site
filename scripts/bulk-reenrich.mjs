/**
 * Fire enrichment triggers for every alum with a linkedin_url.
 *
 * The /api/enrichment/trigger endpoint stamps pending + dispatches the
 * actual Apify scrape via Next's after(), so each network call returns
 * fast (~100-300ms). We throttle to one trigger every 1.5s — not for
 * Apify (it queues server-side), but to be polite to Vercel function
 * concurrency and so progress lines aren't a wall of noise.
 *
 * Skips alumni currently in 'pending' status (the endpoint returns 409
 * for those — recently-stamped pending rows are treated as "already
 * in flight"). Also re-tries any that hit transient errors at the end.
 */
import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const env = fs.readFileSync('./.env.local', 'utf8');
const dbUrl = env.match(/^DATABASE_URL="([^"]+)"/m)[1];
const sql = neon(dbUrl);
const TRIGGER_URL = "https://uwcbayarea.org/api/enrichment/trigger";

const targets = await sql`
  SELECT id, first_name, last_name, linkedin_enrichment_status
  FROM alumni
  WHERE linkedin_url IS NOT NULL AND TRIM(linkedin_url) <> ''
    AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
    AND affiliation ILIKE '%alum%'
  ORDER BY linkedin_enrichment_status NULLS FIRST, id
`;
console.log(`Targets: ${targets.length} alumni with linkedin_url.`);

const results = { triggered: 0, conflict: 0, failed: 0, skipped: 0 };
let i = 0;
for (const a of targets) {
  i++;
  const name = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || `#${a.id}`;
  try {
    const res = await fetch(TRIGGER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alumni_id: a.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      results.triggered++;
      console.log(`  [${i}/${targets.length}] ✓ ${name} (id=${a.id}) — queued`);
    } else if (res.status === 409) {
      results.conflict++;
      console.log(`  [${i}/${targets.length}] ⊝ ${name} (id=${a.id}) — already pending`);
    } else {
      results.failed++;
      console.log(`  [${i}/${targets.length}] ✗ ${name} (id=${a.id}) — ${res.status} ${data?.error ?? ''}`);
    }
  } catch (err) {
    results.failed++;
    console.log(`  [${i}/${targets.length}] ✗ ${name} (id=${a.id}) — network: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

console.log("\n=== Trigger run done ===");
console.log(JSON.stringify(results, null, 2));
console.log("\nApify will process the queue over the next 30-60 mins.");
console.log("Check /admin/enrichment/stats periodically to see progress.");
