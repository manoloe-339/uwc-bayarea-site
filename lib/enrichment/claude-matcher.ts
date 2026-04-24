/**
 * Ports the "best-match candidate" Claude call from
 * scripts/discover_missing_linkedin.py:317-388. Prompt is held verbatim
 * — every bullet point is load-bearing (the UWC-college-mention priority,
 * the graduation-year timeline check, the slug-match caveat, etc.).
 * Changing wording here changes match quality.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  BioSnippet,
  LinkedinCandidate,
  MatchDecision,
} from "@/types/enrichment";
import { ENRICHMENT_CONFIG, requireEnv } from "./constants";

function emailPrefix(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at).toLowerCase() : null;
}

function timelineContext(college: string | null | undefined, gradYear: number | null | undefined): string {
  if (!college || !gradYear) return "";
  const expectedAge = 2026 - gradYear + 18;
  return `\n\nTIMELINE CONTEXT:
This person graduated from ${college} in ${gradYear}, expected age ~${expectedAge} in 2026. When evaluating candidates: (1) Prefer profiles that mention UWC or the specific college name. (2) Check if the career timeline makes sense for someone who graduated in ${gradYear}. (3) If a profile shows significantly more or less experience than expected for that graduation year, mark it as lower confidence.`;
}

function bioContext(bios: BioSnippet[]): string {
  if (!bios.length) return "";
  const lines = bios.map(
    (b) => `  • [${b.title}] (${b.url})\n    ${b.text.slice(0, 300)}`
  );
  return `\n\nIDENTITY CONTEXT (non-LinkedIn web snippets mentioning this person + their UWC college - use to confirm identity, extract middle names, or match candidates):\n${lines.join("\n")}`;
}

function candidateBlock(candidates: LinkedinCandidate[]): string {
  const lines = candidates.map((c, i) => {
    const snippet = (c.text ?? "").slice(0, 250);
    return `  ${i + 1}. ${c.url}\n     Title: ${c.title}\n     Snippet: ${snippet}\n     Source: ${c.source}`;
  });
  return lines.join("\n");
}

function buildPrompt(params: {
  fullName: string;
  college: string | null;
  currentRole: string | null;
  location: string | null;
  email: string | null;
  sector: string | null;
  gradYear: number | null;
  candidates: LinkedinCandidate[];
  bioSnippets: BioSnippet[];
}): string {
  const prefix = emailPrefix(params.email) ?? "(unknown)";
  return `You are matching a UWC alum to their LinkedIn profile.

ALUM INFORMATION (from our records - may be stale):
Name: ${params.fullName}
UWC College: ${params.college ?? "(unknown)"}
Current Role: ${params.currentRole ?? "(unknown)"}
Location: ${params.location ?? "(unknown)"}
Email: ${params.email ?? "(unknown)"}
Email prefix (useful for handle matching): ${prefix}
Sector: ${params.sector ?? "(unknown)"}${timelineContext(params.college, params.gradYear)}${bioContext(params.bioSnippets)}

CANDIDATE LinkedIn URLs:
${candidateBlock(params.candidates)}

Pick the candidate that is MOST LIKELY this same person. Consider, in priority order:
- **UWC college mention in the profile is the strongest single signal.** If a candidate's snippet explicitly mentions the alum's UWC college (e.g., "UWC Mostar", "UWC Mahindra", "UWC-USA", "United World College [X]"), that almost always beats other signals. Prefer this heavily.
- **Source tag matters.** If a candidate's Source is \`serper-uwc\`, \`serper-quoted\`, or \`serper-quoted-post\`, the FULL profile page (not just the snippet you see) was indexed by Google as containing a UWC match - treat this as UWC evidence even if "UWC" is not visible in the truncated snippet. Snippets only show the top ~150 chars of each profile.
- **URL slug / email prefix match.** If the URL slug matches the alum's name (especially middle name) or their email prefix, treat as supporting evidence - but NOT alone sufficient, because slug collisions from unrelated people with the same name are common. Example: email=jane.doe22@uwc-usa.org and URL contains "jane-doe" → supporting signal, but only a confident pick if combined with UWC text, a matching college, a matching career timeline, or a plausible location. A bare slug match with a mismatched career/education is a RED FLAG (different person with the same name), not a confirmation.
- **Career timeline must fit the UWC graduation year.** Years of experience, education dates, and career seniority should be consistent with the alum's UWC grad year. A candidate with 10+ years of professional experience cannot be a 2020+ UWC graduate. Treat significant timeline mismatches as disqualifying.
- **Current role / company / location are LOWEST priority** - our records can be years out of date. A profile based in a different city or with a different job title may still be correct if UWC affiliation + name match.
- **Common-name false positives are dangerous** - only pick if multiple signals align, or the UWC mention is explicit.

Return strict JSON with this exact shape, no markdown fences:
{
  "chosen_index": <1-based index, or null if no confident match>,
  "confidence": "high" | "medium" | "low" | "none",
  "reasoning": "<one sentence why>"
}`;
}

function parseClaudeOutput(
  raw: string,
  candidates: LinkedinCandidate[]
): MatchDecision {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
  }
  const brace = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/s);
  const jsonText = brace ? brace[0] : text;
  let decision: { chosen_index?: unknown; confidence?: string; reasoning?: string } = {};
  try {
    decision = JSON.parse(jsonText);
  } catch {
    return { chosen_url: null, confidence: "none", reasoning: "Could not parse Claude response" };
  }
  const idx = decision.chosen_index;
  const chosen =
    typeof idx === "number" && idx >= 1 && idx <= candidates.length ? candidates[idx - 1].url : null;
  const confidence = (
    ["high", "medium", "low", "none"].includes(String(decision.confidence))
      ? decision.confidence
      : "low"
  ) as MatchDecision["confidence"];
  return {
    chosen_url: chosen,
    confidence,
    reasoning: String(decision.reasoning ?? ""),
  };
}

/**
 * Ask Claude to pick the single best candidate. Returns { chosen_url: null }
 * if Claude declines to pick — caller should write that as needs_review.
 */
export async function pickBestCandidate(params: {
  fullName: string;
  college: string | null;
  currentRole: string | null;
  location: string | null;
  email: string | null;
  sector: string | null;
  gradYear: number | null;
  candidates: LinkedinCandidate[];
  bioSnippets: BioSnippet[];
}): Promise<MatchDecision> {
  if (params.candidates.length === 0) {
    return { chosen_url: null, confidence: "none", reasoning: "No candidates found" };
  }
  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  const prompt = buildPrompt(params);
  const resp = await client.messages.create({
    model: ENRICHMENT_CONFIG.CLAUDE_MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });
  const first = resp.content[0];
  const text = first && first.type === "text" ? first.text : "";
  return parseClaudeOutput(text, params.candidates);
}
