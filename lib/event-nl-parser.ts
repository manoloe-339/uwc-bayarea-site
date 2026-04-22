import Anthropic from "@anthropic-ai/sdk";
import { INDUSTRY_GROUPS, type IndustryGroup } from "./industry-groups";

export type DiversityDimension = "origin" | "school" | "region" | "company" | "age";
export type CompanySizeBand = "startup" | "large";

export type ParsedEventQuery = {
  eventSize: number;
  industryGroups: IndustryGroup[];
  city: string | null;
  region: string | null;
  international: boolean;
  minGradYear: number | null;
  maxGradYear: number | null;
  companyName: string | null;
  companySizeBand: CompanySizeBand | null;
  diversityDimensions: DiversityDimension[];
  rankByEngagement: boolean;
  rankByRecency: boolean;
  keywords: string[];
};

export type ParseResult =
  | { ok: true; parsed: ParsedEventQuery }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `You are an event planning assistant for a UWC Bay Area alumni network. Parse the user's event description into structured JSON.

Return ONLY a JSON object. No prose, no markdown fences — just the object.

Fields (every field required; use null or [] when absent):
{
  "event_size": <number, default 20 if not specified>,
  "industry_groups": [<zero or more of: "Tech & Hardware", "Finance & Investing", "Consulting", "Education", "Non-Profit & Social Impact", "Research & Science", "Healthcare">],
  "city": <string or null — normalize to canonical form like "San Francisco", "Berkeley", "Oakland", "Palo Alto", etc.>,
  "region": <one of "SF", "East Bay", "Peninsula", "South Bay", "North Bay" or null>,
  "international": <boolean — true only if user explicitly wants non-US>,
  "min_grad_year": <integer or null>,
  "max_grad_year": <integer or null>,
  "company_name": <string or null — specific company mentioned like "Google">,
  "company_size_band": <"startup" | "large" | null>,
  "diversity_dimensions": [<zero or more of: "origin", "school", "region", "company", "age">],
  "rank_by_engagement": <boolean>,
  "rank_by_recency": <boolean>,
  "keywords": [<remaining specific terms not covered elsewhere, e.g. "product management", "climate tech", "UX">]
}

Mapping rules:
- "20 people" / "fifteen alumni" / "around 30" → event_size
- "tech", "software", "AI", "ML", "engineering", "robotics", "hardware", "semiconductor" → include "Tech & Hardware"
- "finance", "VC", "investing", "banking", "PE", "asset management" → include "Finance & Investing"
- "consulting", "strategy" → include "Consulting"
- "education", "academia", "professor" → include "Education"
- "nonprofit", "NGO", "government", "public sector" → include "Non-Profit & Social Impact"
- "research", "science", "biotech" → include "Research & Science"
- "healthcare", "medical", "pharma" → include "Healthcare"
- "SF" / "San Francisco" → city "San Francisco"; "East Bay" → region; multiple locations → pick the most specific; "Bay Area" → leave city and region null
- "international" / "abroad" → international true
- "senior", "40+", "experienced", "older", "before 2010" → max_grad_year 2010
- "skew older around 40+" → max_grad_year 2012 (loose)
- "recent grads", "younger", "under 30", "after 2018" → min_grad_year 2018
- "age diversity", "mix of ages", "different generations" → include "age" in diversity_dimensions, leave min/max_grad_year null
- Age filter ("skew older") and age diversity are MUTUALLY EXCLUSIVE — never both
- "good mix", "diverse group", "variety", "balanced" → include ALL of ["origin", "school", "region", "company", "age"] (minus any dimensions explicitly filtered like age if user said "40+")
- "different countries" / "international mix" / "origin diversity" → include "origin"
- "different UWC schools" / "school variety" → include "school"
- "different neighborhoods" / "Bay Area diversity" / "not all from SF" → include "region"
- "different companies" / "variety of companies" → include "company"
- "startup" / "early-stage" → company_size_band "startup"
- "big tech" / "large company" / "enterprise" → company_size_band "large"
- "engaged" / "active" / "opens emails" / "responsive" / "high engagement" → rank_by_engagement true
- "up-to-date" / "recently updated" / "recent profiles" / "current info" → rank_by_recency true
- Everything else specific (e.g. "product management", "climate tech", "impact investing") → keywords

Do NOT invent filters not supported by the input. When in doubt, leave null / empty.`;

function isJsonParsable(text: string): string | null {
  // Strip markdown fences / leading prose, find the first JSON object.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function normalize(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Parser returned non-object" };
  }
  const r = raw as Record<string, unknown>;

  const industryGroups: IndustryGroup[] = [];
  if (Array.isArray(r.industry_groups)) {
    for (const g of r.industry_groups) {
      if (typeof g === "string" && (INDUSTRY_GROUPS as readonly string[]).includes(g)) {
        industryGroups.push(g as IndustryGroup);
      }
    }
  }

  const diversityDimensions: DiversityDimension[] = [];
  const validDims: DiversityDimension[] = ["origin", "school", "region", "company", "age"];
  if (Array.isArray(r.diversity_dimensions)) {
    for (const d of r.diversity_dimensions) {
      if (typeof d === "string" && (validDims as string[]).includes(d)) {
        diversityDimensions.push(d as DiversityDimension);
      }
    }
  }

  const validSizes: CompanySizeBand[] = ["startup", "large"];
  const companySizeBand =
    typeof r.company_size_band === "string" && (validSizes as string[]).includes(r.company_size_band)
      ? (r.company_size_band as CompanySizeBand)
      : null;

  const validRegions = ["SF", "East Bay", "Peninsula", "South Bay", "North Bay"];
  const region =
    typeof r.region === "string" && validRegions.includes(r.region) ? r.region : null;

  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  };
  const str = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    return null;
  };

  const eventSize = num(r.event_size) ?? 20;

  return {
    ok: true,
    parsed: {
      eventSize: Math.max(1, Math.min(100, eventSize)),
      industryGroups,
      city: str(r.city),
      region,
      international: r.international === true,
      minGradYear: num(r.min_grad_year),
      maxGradYear: num(r.max_grad_year),
      companyName: str(r.company_name),
      companySizeBand,
      diversityDimensions,
      rankByEngagement: r.rank_by_engagement === true,
      rankByRecency: r.rank_by_recency === true,
      keywords: Array.isArray(r.keywords)
        ? r.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        : [],
    },
  };
}

/**
 * Parse a free-text event description into structured filters + event-mode
 * settings via Claude Haiku. Returns ok:false if the API key is missing, the
 * call fails, or the response isn't valid JSON — callers should fall back to
 * treating the query as a plain fuzzy-search `q`.
 */
export async function parseEventQuery(query: string): Promise<ParseResult> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, error: "Empty query" };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY not set" };

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Parse this event description: "${trimmed}"` }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const jsonSlice = isJsonParsable(text);
    if (!jsonSlice) return { ok: false, error: "No JSON in parser response" };
    const raw = JSON.parse(jsonSlice);
    return normalize(raw);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "parse failed" };
  }
}
