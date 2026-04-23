import { config } from "dotenv";
config({ path: ".env.local" });
import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const args = new Set(process.argv.slice(2));
const AMBIGUOUS_ONLY = args.has("--ambiguous-only");

const SYS = `You classify a person's likely gender for an alumni database. Values: "male" | "female" | "they" | "unknown".

Rules, in priority order:
1. EXPLICIT PRONOUNS in the person's headline or linkedin_about override everything else.
   - she/her → "female"
   - he/him → "male"
   - they/them → "they"
2. Otherwise use the FIRST NAME + ORIGIN (country) together. Same name can be gendered differently across cultures.
3. If a photo is attached, use it as an ADDITIONAL signal — not a definitive one. Photos can be unreliable (lighting, stylization, group shots, trans/non-conforming presentations). Only use the photo to bump an ambiguous name+origin case from "unknown" to a best-guess with MODERATE confidence (≤0.8). Never override explicit pronouns with the photo.
4. "they" is ONLY for EXPLICITLY stated they/them pronouns. Do NOT default to "they".
5. Use "unknown" when you genuinely can't determine. Lowering confidence is better than guessing.
6. Confidence: 0.95+ obvious; 0.75-0.9 strong; 0.5-0.75 plausible; <0.5 prefer unknown.

Return ONLY JSON:
{ "gender": "male"|"female"|"they"|"unknown", "confidence": 0-1, "reasoning": "<=150 chars" }`;

async function classify(a) {
  const textLines = [
    `name: ${a.first_name}${a.last_name ? " " + a.last_name : ""}`,
    a.origin ? `origin: ${a.origin}` : "",
    a.headline ? `headline: ${a.headline}` : "",
    a.linkedin_about ? `linkedin_about: ${a.linkedin_about.slice(0, 800)}` : "",
  ].filter(Boolean);
  const content = [];
  if (a.photo_url) {
    content.push({ type: "image", source: { type: "url", url: a.photo_url } });
  }
  content.push({ type: "text", text: `Classify:\n${textLines.join("\n")}` });
  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      temperature: 0,
      system: SYS,
      messages: [{ role: "user", content }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const raw = JSON.parse(text.slice(start, end + 1));
    const g = ["male", "female", "they", "unknown"].includes(raw.gender) ? raw.gender : "unknown";
    return {
      gender: g,
      confidence: Math.max(0, Math.min(1, raw.confidence ?? 0)),
      reasoning: String(raw.reasoning ?? "").slice(0, 300),
    };
  } catch (err) {
    return { error: err.message };
  }
}

const baseQuery = AMBIGUOUS_ONLY
  ? sql`
      SELECT id, first_name, last_name, origin, headline, linkedin_about, photo_url
      FROM alumni
      WHERE deceased IS NOT TRUE AND first_name IS NOT NULL
        AND gender_source IS DISTINCT FROM 'admin'
        AND (gender IS NULL OR gender = 'unknown' OR gender_confidence < 0.75)
      ORDER BY id
    `
  : sql`
      SELECT id, first_name, last_name, origin, headline, linkedin_about, photo_url
      FROM alumni
      WHERE deceased IS NOT TRUE AND first_name IS NOT NULL
        AND gender_source IS DISTINCT FROM 'admin'
      ORDER BY id
    `;
const rows = await baseQuery;
console.log(`${AMBIGUOUS_ONLY ? "Re-classifying ambiguous" : "Classifying all"}: ${rows.length} alumni (${rows.filter((r) => r.photo_url).length} with photos)`);

let done = 0;
let failed = 0;
const CONCURRENCY = 8;
let idx = 0;
const results = new Array(rows.length);

async function worker() {
  while (true) {
    const i = idx++;
    if (i >= rows.length) return;
    const a = rows[i];
    const r = await classify(a);
    if (!r || r.error) {
      failed++;
      if (r && r.error) console.error(`  #${a.id} ${a.first_name}: ${r.error}`);
    } else {
      results[i] = { ...a, ...r, had_photo: !!a.photo_url };
      await sql`UPDATE alumni SET gender = ${r.gender}, gender_confidence = ${r.confidence}, gender_source = 'llm' WHERE id = ${a.id}`;
    }
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${rows.length}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
console.log(`\nDone: ${done} classified, ${failed} failed.`);

const counts = {};
for (const r of results) if (r) counts[r.gender] = (counts[r.gender] ?? 0) + 1;
console.log("\nDistribution (this run):", counts);

const review = results.filter((r) => r && (r.gender === "unknown" || r.confidence < 0.75));
console.log(`\n=== Still unknown / low-confidence (${review.length}) ===`);
for (const r of review.sort((a, b) => a.confidence - b.confidence)) {
  const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
  const photoFlag = r.had_photo ? " [photo]" : " [no-photo]";
  console.log(
    `  #${r.id} · ${name}${photoFlag} · origin=${r.origin ?? "-"} · ${r.gender} (${Math.round(r.confidence * 100)}%) — ${r.reasoning}`
  );
}
