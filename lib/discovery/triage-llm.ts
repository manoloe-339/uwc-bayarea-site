/**
 * Claude-powered triage of search hits. For each LinkedIn snippet,
 * decide:
 *   - Is the person an alumnus (vs teacher/staff/parent/unrelated)?
 *   - Are they currently in the SF Bay Area?
 *   - Confidence in the call.
 *
 * Cost ~$0.0001 per call with Haiku 4.5. ~150 hits/batch = ~$0.015.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ENRICHMENT_CONFIG } from "@/lib/enrichment/constants";

export type TriageResult = {
  is_alum: "yes" | "no" | "unclear";
  in_bay_area: "yes" | "no" | "unclear";
  role: "alum" | "teacher" | "staff" | "unrelated";
  confidence: "high" | "medium" | "low";
  reasoning: string;
};

const SYSTEM_PROMPT = `You scan LinkedIn search-result snippets and decide whether the person is:
1. A UWC alumnus (graduated from one of the 18 United World College campuses) — NOT a teacher, instructor, staff, or parent of an alumnus.
2. Currently based in the San Francisco Bay Area (SF, Oakland, Berkeley, Palo Alto, San Jose, Marin, Peninsula, South Bay, East Bay, Mountain View, etc.).

Respond ONLY with strict JSON, no markdown, no extra text:
{
  "is_alum": "yes" | "no" | "unclear",
  "in_bay_area": "yes" | "no" | "unclear",
  "role": "alum" | "teacher" | "staff" | "unrelated",
  "confidence": "high" | "medium" | "low",
  "reasoning": "one short sentence"
}

Important hints:
- "UWC instructor", "teacher at UWC", "Head of school" → role: teacher.
- "Class of [year], UWC X" or "[School name] alumna" or "Davis Scholar" → role: alum.
- Costa Rica the country (San José, CR) is NOT the Bay Area.
- "San Jose" without country usually means California; "San Jose, CR" or similar = Costa Rica.
- "California" alone is broader than Bay Area; mark in_bay_area unclear unless something narrows it.
- A profile that mentions UWC only because they live near a UWC campus (not as a student) → unrelated.
- KNOWN FALSE POSITIVE: "University of the Western Cape" (often abbreviated UWC) is a South African university — NOT a United World College. If the snippet mentions "Western Cape", the person is almost certainly not a UWC alumnus → role: unrelated, confidence: high.
- "Pearson College UWC" is a UWC; "Pearson Education" or "Pearson plc" is a publishing company → unrelated.

CONFIDENCE RULES — be strict, this matters:
- "high" REQUIRES is_alum = "yes" AND in_bay_area = "yes". Both must be clearly evidenced. ANY other combination is NOT high.
- "medium" = one of the two is "yes" with strong evidence, the other is "unclear" or weakly hinted.
- "low" = either is "no", or both are "unclear", or the snippet is too sparse to judge.

Examples:
- UWC alum (clear) living in Ecuador (clear) → confidence "low" (not in Bay Area).
- UWC alum (clear) living in California unclear which city → confidence "medium".
- UWC alum (clear) living in San Francisco (clear) → confidence "high".
- Snippet mentions a UWC campus but person is a teacher/staff there → confidence "low" (not an alum).

The point of "high" is to surface candidates the admin should action FIRST. Don't dilute it.`;

function safeParse(text: string): TriageResult | null {
  // Claude sometimes wraps JSON in ```json fences despite the prompt.
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    if (
      obj &&
      typeof obj === "object" &&
      ["yes", "no", "unclear"].includes(obj.is_alum) &&
      ["yes", "no", "unclear"].includes(obj.in_bay_area) &&
      ["alum", "teacher", "staff", "unrelated"].includes(obj.role) &&
      ["high", "medium", "low"].includes(obj.confidence) &&
      typeof obj.reasoning === "string"
    ) {
      return obj as TriageResult;
    }
  } catch {
    // fall through
  }
  return null;
}

export async function triageHit(
  client: Anthropic,
  args: { url: string; title: string; snippet: string }
): Promise<TriageResult | null> {
  try {
    const resp = await client.messages.create({
      model: ENRICHMENT_CONFIG.CLAUDE_MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `URL: ${args.url}\nTitle: ${args.title}\nSnippet: ${args.snippet}`,
        },
      ],
    });
    const text = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return safeParse(text);
  } catch (err) {
    console.error("[discovery/triage-llm] Claude error:", err);
    return null;
  }
}
