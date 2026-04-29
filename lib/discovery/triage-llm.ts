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
  role: "alum" | "student" | "teacher" | "staff" | "unrelated";
  confidence: "high" | "medium" | "low";
  reasoning: string;
};

const SYSTEM_PROMPT = `You scan LinkedIn search-result snippets to find people we'd want in our United World College Bay Area alumni database. We want anyone with a UWC AFFILIATION:
- a UWC ALUMNUS (graduated from one of the 18 United World College campuses), OR
- a CURRENT UWC STUDENT (still enrolled — they may register through us if their family is here).

We do NOT want teachers, instructors, staff, or unaffiliated mentions.

Decisions to make for each profile:
1. Is the person a UWC alumnus OR a current UWC student? (For "is_alum" below: count both as "yes" — we treat both as worth pursuing.)
2. Are they currently based in the San Francisco Bay Area (SF, Oakland, Berkeley, Palo Alto, San Jose, Marin, Peninsula, South Bay, East Bay, Mountain View, etc.)?

Respond ONLY with strict JSON, no markdown, no extra text:
{
  "is_alum": "yes" | "no" | "unclear",
  "in_bay_area": "yes" | "no" | "unclear",
  "role": "alum" | "student" | "teacher" | "staff" | "unrelated",
  "confidence": "high" | "medium" | "low",
  "reasoning": "one short sentence"
}

Role rules:
- "alum" — graduated from a UWC. is_alum = "yes".
- "student" — currently enrolled at a UWC (no graduation year, or year is in the future). is_alum = "yes" (we treat them the same for outreach).
- "teacher" — instructor, teacher, faculty, head of school AT a UWC. is_alum = "no".
- "staff" — admin / support staff at a UWC, or staff at a UWC parent org (UWC International, etc.). is_alum = "no".
- "unrelated" — page mentions UWC for unrelated reasons (e.g. lives near campus, parent name dropped). is_alum = "no".

Geographic hints:
- Costa Rica the country (San José, CR) is NOT the Bay Area.
- "San Jose" without country usually means California; "San Jose, CR" / "San José, Costa Rica" = Costa Rica.
- "California" alone is broader than Bay Area; mark in_bay_area "unclear" unless something narrows it.

Known false positives:
- "University of the Western Cape" (often abbreviated UWC) is a South African university — NOT a United World College. Snippet mentions "Western Cape" → role: "unrelated", confidence: "high".
- "Pearson College UWC" is a UWC; "Pearson Education" or "Pearson plc" is a publishing company → "unrelated".

CONFIDENCE RULES — be strict:
- "high" REQUIRES is_alum = "yes" AND in_bay_area = "yes". Both must be clearly evidenced. ANY other combination is NOT high.
- "medium" = one of the two is "yes" with strong evidence, the other is "unclear" or weakly hinted.
- "low" = either is "no", or both are "unclear", or the snippet is too sparse to judge.

Examples:
- UWC alum (clear) living in Ecuador (clear) → "low" (not in Bay Area).
- Current UWC student in California, unclear city → "medium".
- UWC alum (clear) living in San Francisco (clear) → "high".
- Teacher at UWC X based in SF → "low" (not an alum/student).

"high" is for the candidates the admin should action FIRST. Don't dilute it.`;

/**
 * Enforce the confidence rules deterministically — Claude can drift on
 * "high requires both yes" even with a strict prompt. This function is
 * the source of truth:
 *   - is_alum=no OR in_bay_area=no  → confidence is "low"
 *   - is_alum=yes AND in_bay_area=yes → trust Claude (high/medium/low ok)
 *   - any combination involving "unclear" → cap at "medium" (never high)
 */
function enforceConfidence(t: TriageResult): TriageResult {
  const { is_alum, in_bay_area, confidence } = t;
  if (is_alum === "no" || in_bay_area === "no") {
    return { ...t, confidence: "low" };
  }
  if (is_alum === "yes" && in_bay_area === "yes") {
    return t; // both yes; trust Claude's call
  }
  // At least one "unclear" — never high.
  if (confidence === "high") {
    return { ...t, confidence: "medium" };
  }
  return t;
}

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
    const parsed = safeParse(text);
    return parsed ? enforceConfidence(parsed) : null;
  } catch (err) {
    console.error("[discovery/triage-llm] Claude error:", err);
    return null;
  }
}
