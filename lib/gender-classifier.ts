import Anthropic from "@anthropic-ai/sdk";

export type GenderInput = {
  firstName: string;
  lastName?: string | null;
  origin?: string | null;
  headline?: string | null;
  linkedinAbout?: string | null;
  /** Public URL of the alumnus's photo (if any). When present, Claude
   * gets the image alongside the text context as an additional signal. */
  photoUrl?: string | null;
};

export type GenderValue = "male" | "female" | "they" | "unknown";

export type GenderOutput = {
  gender: GenderValue;
  confidence: number; // 0-1
  reasoning: string;
};

export type GenderResult =
  | { ok: true; data: GenderOutput }
  | { ok: false; error: string };

const MODEL = "claude-haiku-4-5-20251001";

function systemPrompt(): string {
  return `You classify a person's likely gender for an alumni database. Values: "male" | "female" | "they" | "unknown".

Rules, in priority order:
1. EXPLICIT PRONOUNS in the person's headline or linkedin_about override everything else. Look for "(she/her)", "she/her", "pronouns: he/him", "(they/them)", etc.
   - she/her → "female"
   - he/him → "male"
   - they/them → "they"
2. Otherwise use the FIRST NAME + ORIGIN (country) together. The same name can be gendered differently across cultures. Examples:
   - "Andrea": male in Italy, female in US/UK/most of Europe
   - "Sasha": commonly male in Russia, often female in the US
   - "Alex": ambiguous everywhere — lean "unknown" unless other signal
   - "Nikita": male in Russia, female in the US/UK
   - "Kim": ambiguous (female in US, often male in Korea)
   - "Jordan", "Taylor", "Morgan", "Robin", "Casey" — commonly ambiguous
3. If a photo is attached, use it as an ADDITIONAL signal — not a definitive one. Photos can be unreliable (lighting, stylization, group shots, trans/non-conforming presentations). Only use the photo to bump an ambiguous name+origin case from "unknown" to a best-guess with MODERATE confidence (≤0.8). Never override explicit pronouns with the photo.
4. "they" is ONLY for EXPLICITLY stated they/them pronouns. Do NOT use "they" as a safe default.
5. Use "unknown" when you genuinely can't determine from the available data — including when the photo is unclear. Lowering confidence is better than guessing.
6. Confidence guide:
   - 0.95+ : obvious (explicit pronouns, or very common single-gender name in matching origin, or clear name + confirming photo)
   - 0.75-0.9 : strong signal but not explicit (name matches origin conventions clearly, or photo strongly confirms an ambiguous name)
   - 0.5-0.75 : plausible but ambiguous (weak photo signal, or ambiguous name with some origin context)
   - <0.5 : prefer "unknown"

Return ONLY JSON:
{ "gender": "male"|"female"|"they"|"unknown", "confidence": 0-1, "reasoning": "<=150 chars" }`;
}

function userText(c: GenderInput): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  const fields = [
    `name: ${name}`,
    c.origin ? `origin: ${c.origin}` : null,
    c.headline ? `headline: ${c.headline}` : null,
    c.linkedinAbout ? `linkedin_about: ${c.linkedinAbout.slice(0, 800)}` : null,
  ].filter(Boolean);
  return `Classify:\n${fields.join("\n")}`;
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export async function classifyGender(input: GenderInput): Promise<GenderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY not set" };
  if (!input.firstName || !input.firstName.trim()) {
    return { ok: true, data: { gender: "unknown", confidence: 0, reasoning: "No first name" } };
  }
  try {
    const client = new Anthropic({ apiKey });
    const content: Anthropic.Messages.ContentBlockParam[] = [];
    if (input.photoUrl) {
      content.push({
        type: "image",
        source: { type: "url", url: input.photoUrl },
      });
    }
    content.push({ type: "text", text: userText(input) });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      temperature: 0,
      system: systemPrompt(),
      messages: [{ role: "user", content }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const slice = extractJson(text);
    if (!slice) return { ok: false, error: "No JSON" };
    const raw = JSON.parse(slice) as Record<string, unknown>;
    const g = typeof raw.gender === "string" ? raw.gender : "unknown";
    const gender: GenderValue =
      g === "male" || g === "female" || g === "they" ? g : "unknown";
    const conf = typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0;
    const reasoning = typeof raw.reasoning === "string" ? raw.reasoning.slice(0, 300) : "";
    return { ok: true, data: { gender, confidence: conf, reasoning } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "classify failed" };
  }
}

export const GENDER_CLASSIFIER_MODEL = MODEL;
