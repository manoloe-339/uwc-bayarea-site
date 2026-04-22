import Anthropic from "@anthropic-ai/sdk";

export type CompanyMeta = {
  key: string; // canonical lowercase name — used to match alumni rows
  name: string;
  industry?: string | null;
  sector?: string | null; // from company_classifications (if previously classified)
};

export type AiFilterResult =
  | { ok: true; matches: Set<string>; reasoning: Map<string, string> }
  | { ok: false; error: string };

const MODEL = "claude-haiku-4-5-20251001";

// Claude's JSON output reliability drops with very long arrays (we've seen
// it truncate mid-array at ~150 objects). Chunk the input and parallelize
// to keep each response small and robust.
const BATCH_SIZE = 50;
const MAX_BATCHES = 8; // sanity cap — 400 companies max per filter call

function systemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `TODAY IS ${today}.
You are deciding, for each company in a list, whether it matches a free-text criterion from the user. Use your general knowledge of each company — the LinkedIn industry label is often misleading.

Return ONLY a JSON object of the form:
{
  "matches": [
    { "key": "<company_key>", "match": true|false, "reason": "short sentence" }
  ]
}

Rules:
- One entry per input company. Same company_key strings.
- "reason" ≤ 100 chars.
- If you don't know a company, set match=false and reason="Unknown / insufficient info". Don't guess.
- Interpret the user's criterion charitably but specifically. Edge cases go to false.`;
}

function userMessage(question: string, companies: CompanyMeta[]): string {
  const rows = companies.map((c) => {
    const parts = [
      `key=${c.key}`,
      `name=${c.name}`,
      c.industry ? `linkedin_industry=${c.industry}` : null,
      c.sector ? `sector=${c.sector}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  });
  return `Criterion: ${question}

Companies (${companies.length}):
${rows.join("\n")}`;
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function runOneBatch(
  client: Anthropic,
  question: string,
  batch: CompanyMeta[]
): Promise<{ matches: Set<string>; reasoning: Map<string, string> } | { error: string }> {
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: systemPrompt(),
      messages: [{ role: "user", content: userMessage(question, batch) }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const slice = extractJson(text);
    if (!slice) return { error: "No JSON in response" };
    const raw = JSON.parse(slice);
    const arr = Array.isArray(raw?.matches) ? raw.matches : null;
    if (!arr) return { error: "No 'matches' array" };

    const matches = new Set<string>();
    const reasoning = new Map<string, string>();
    for (const m of arr) {
      if (!m || typeof m !== "object") continue;
      const key = typeof m.key === "string" ? m.key : null;
      const isMatch = m.match === true;
      const reason = typeof m.reason === "string" ? m.reason : "";
      if (!key) continue;
      if (isMatch) matches.add(key);
      if (reason) reasoning.set(key, reason);
    }
    return { matches, reasoning };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "batch failed" };
  }
}

/**
 * Ask Claude which companies in the given list match the user's free-text
 * criterion. Splits large inputs into parallel batches of 50 so Claude's
 * JSON output stays within a reliable-length window per call. On any batch
 * failure, returns the first error; partial results aren't merged.
 */
export async function runAiFilter(
  question: string,
  companies: CompanyMeta[]
): Promise<AiFilterResult> {
  const q = question.trim();
  if (!q) return { ok: false, error: "Empty question" };
  if (companies.length === 0) return { ok: true, matches: new Set(), reasoning: new Map() };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY not set" };

  // Chunk into BATCH_SIZE groups, sanity-capped at MAX_BATCHES total.
  const usable = companies.slice(0, BATCH_SIZE * MAX_BATCHES);
  const batches: CompanyMeta[][] = [];
  for (let i = 0; i < usable.length; i += BATCH_SIZE) {
    batches.push(usable.slice(i, i + BATCH_SIZE));
  }

  const client = new Anthropic({ apiKey });
  const results = await Promise.all(batches.map((b) => runOneBatch(client, q, b)));

  const matches = new Set<string>();
  const reasoning = new Map<string, string>();
  const errs: string[] = [];
  for (const r of results) {
    if ("error" in r) {
      errs.push(r.error);
      continue;
    }
    for (const k of r.matches) matches.add(k);
    for (const [k, v] of r.reasoning) reasoning.set(k, v);
  }
  if (errs.length === results.length) {
    return { ok: false, error: errs[0] };
  }
  return { ok: true, matches, reasoning };
}
