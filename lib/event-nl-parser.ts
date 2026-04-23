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

export type ParsedSearchQuery = {
  industryGroups: IndustryGroup[];
  city: string | null;
  region: string | null;
  minGradYear: number | null;
  maxGradYear: number | null;
  companyName: string | null;
  companySizeBand: CompanySizeBand | null;
  /** Canonical UWC school name. */
  college: string | null;
  /** Non-UWC education (undergrad / grad school). */
  university: string | null;
  origin: string | null;
  /** Classification-backed tech/startup filter. Preferred over industry/size when user intent is semantic. */
  companyTag: "tech" | "non_tech" | "startup" | "not_startup" | null;
  /** Classification-backed sector (e.g. ai_research, fintech, biotech_research). */
  sector: string | null;
  keywords: string[];
};

export type SearchParseResult =
  | { ok: true; parsed: ParsedSearchQuery }
  | { ok: false; error: string };

function ageRules(thisYear: number): string {
  // Pre-computed so Claude doesn't have to do arithmetic — it was
  // intermittently dropping the +18 UWC graduation offset and landing
  // 18 years too early. TWO tables: one for raw ages, one directly for
  // the "older than N" phrasing (same values — belt-and-suspenders).
  const forAge = (a: number) => thisYear - a + 18;
  return `- Age is in YEARS OLD; the database stores GRADUATION YEAR. UWC alumni graduate at ~18, so a 30-year-old graduated ~12 years ago (NOT 30).

- Age → grad_year lookup (use these EXACT values, never compute):
  * age 22 → grad_year ${forAge(22)}
  * age 25 → grad_year ${forAge(25)}
  * age 28 → grad_year ${forAge(28)}
  * age 30 → grad_year ${forAge(30)}
  * age 33 → grad_year ${forAge(33)}
  * age 35 → grad_year ${forAge(35)}
  * age 38 → grad_year ${forAge(38)}
  * age 40 → grad_year ${forAge(40)}
  * age 45 → grad_year ${forAge(45)}
  * age 50 → grad_year ${forAge(50)}
  * age 55 → grad_year ${forAge(55)}

- "older than N" / "over N" / "N+" / "above N" → emit max_grad_year = the grad_year for age N from the table above.
  EXPLICIT EXAMPLES:
  * "older than 30" / "30+" / "over 30" → max_grad_year ${forAge(30)}
  * "older than 35" / "35+" → max_grad_year ${forAge(35)}
  * "older than 40" / "40+" / "above 40" → max_grad_year ${forAge(40)}
  * "older than 45" / "45+" → max_grad_year ${forAge(45)}

- "younger than N" / "under N" / "below N" → emit min_grad_year = grad_year for age N.
  * "under 30" → min_grad_year ${forAge(30)}
  * "under 35" → min_grad_year ${forAge(35)}

- "around N" / "about N years old" → min_grad_year = value for age (N+3), max_grad_year = value for age (N-3)

- "senior alumni" / "experienced" / "older" (no number) → max_grad_year 2010
- "recent grads" / "younger" (no number) → min_grad_year 2018

- CRITICAL: The grad_year is ALWAYS within ~18 years of today, because alumni graduated UWC at 18. A 40-year-old today graduated in ${forAge(40)}, NOT in 1986 / 1984 / 1980. If you're about to emit max_grad_year less than 1990, STOP — you made the off-by-18 error. Clip to 1990 as a safety net.

- Age filter and age diversity are MUTUALLY EXCLUSIVE — never both.`;
}

function eventSystemPrompt(thisYear: number): string {
  const today = new Date().toISOString().slice(0, 10);
  return `TODAY'S DATE IS ${today}. THE CURRENT YEAR IS ${thisYear}. Ignore any training-data default like "2024"; use the year I just gave you for every calculation.

You are an event planning assistant for a UWC Bay Area alumni network. Parse the user's event description into structured JSON.

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
${ageRules(thisYear)}
- "skew older around 40+" → max_grad_year ${thisYear - 40 + 18} (approximate, slight loosening OK)
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
- Keywords capture ONLY substantive professional terms that describe what someone works on or has expertise in — e.g. "product management", "climate tech", "impact investing", "machine learning", "UX design", "developer relations".
- Never emit these as keywords (they describe the event, not the person): "dinner", "lunch", "breakfast", "brunch", "reception", "mixer", "meetup", "happy hour", "gathering", "gala", "panel", "workshop", "conference", "fireside", "roundtable", "event", "session", "networking", "party", "drinks". These are format words, not search terms.
- Never emit as keywords: generic quantity or group words ("people", "alumni", "folks", "individuals", "professionals", "leaders", "crowd", "group"). "Senior leaders" → use age filter, not keywords.
- If nothing professional remains after stripping event-format words and generic quantifiers, return an empty keywords array.

Do NOT invent filters not supported by the input. When in doubt, leave null / empty.`;
}

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

function searchSystemPrompt(thisYear: number): string {
  const today = new Date().toISOString().slice(0, 10);
  return `TODAY'S DATE IS ${today}. THE CURRENT YEAR IS ${thisYear}. Ignore any training-data default like "2024"; use the year I just gave you for every calculation.

You are an alumni search assistant for a UWC Bay Area alumni network. Parse the user's free-text search query into structured filters.

Return ONLY a JSON object. No prose, no markdown fences.

Schema (every field required; use null or [] when absent):
{
  "industry_groups": [<zero or more of: "Tech & Hardware", "Finance & Investing", "Consulting", "Education", "Non-Profit & Social Impact", "Research & Science", "Healthcare">],
  "city": <string or null — canonical like "San Francisco", "Berkeley", "Oakland", "Palo Alto">,
  "region": <one of "SF", "East Bay", "Peninsula", "South Bay", "North Bay" or null>,
  "min_grad_year": <integer or null>,
  "max_grad_year": <integer or null>,
  "company_name": <string or null — specific current employer mentioned like "Google", "McKinsey">,
  "company_size_band": <"startup" | "large" | null>,
  "college": <string or null — UWC school only: canonical forms like "UWC Atlantic", "UWC Mahindra", "UWC USA", "UWC South East Asia", "UWC Red Cross Nordic", "UWC Adriatic", "UWC Maastricht", "UWC Li Po Chun", "UWC Dilijan", "UWC Costa Rica", "UWC Mostar", "UWC Changshu", "UWC Robert Bosch", "UWC Waterford Kamhlaba", "UWC Pearson", "UWC ISAK Japan", "UWC Thailand", "UWC East Africa", "UWC Mahindra">,
  "university": <string or null — non-UWC undergrad / grad / postgrad like "Berkeley", "Stanford", "MIT", "Harvard", "Brown", "Minerva", "LSE", etc.>,
  "origin": <string or null — country the alumnus is from, e.g. "Brazil", "Singapore">,
  "company_tag": <"tech" | "non_tech" | "startup" | "not_startup" | null — semantic, classification-backed; prefer this over industry_groups/company_size_band when the user's intent is "tech" or "startup" semantically>,
  "sector": <null OR one of: "ai_research", "enterprise_saas", "consumer_tech", "developer_tools", "fintech", "biotech_research", "healthcare", "consulting", "academic", "government", "nonprofit", "finance", "media", "education", "energy", "industrial", "other" — use when user names a domain like "AI people", "fintech folks", "biotech", "developer tools">,
  "keywords": [<substantive professional terms only — e.g. "product management", "climate tech", "UX design">]
}

Rules:
- "tech"/"software"/"AI"/"ML"/"engineering" → include "Tech & Hardware"
- "finance"/"VC"/"investing"/"banking"/"PE" → include "Finance & Investing"
- "consulting"/"strategy" → include "Consulting"
- "education"/"academia" → include "Education"
- "nonprofit"/"NGO"/"government" → include "Non-Profit & Social Impact"
- "research"/"biotech" → include "Research & Science"
- "healthcare"/"medical" → include "Healthcare"
- "or" / "and" between industries → include both (e.g. "finance or consulting" → both groups)
- "SF"/"San Francisco" → city; "East Bay" → region; don't set city if user said "Bay Area" generically
${ageRules(thisYear)}
- "tech" / "in tech" / "tech people" → company_tag "tech" (use the classification-backed tag, NOT industry_groups). LinkedIn's industry tags misclassify AI companies as "Research Services" and fintechs as "Financial Services", so the semantic tag is more accurate.
- "non-tech" / "not in tech" / "except tech" / "outside of tech" → company_tag "non_tech". Do NOT use industry_groups for this.
- "startup" / "early-stage" / "at a startup" → company_tag "startup" (classification-backed, reflects real startup status vs. headcount proxy).
- "not a startup" / "established company" / "mature company" → company_tag "not_startup".
- Only fall back to industry_groups when the user names specific domains (e.g. "finance people", "consultants", "educators") that aren't about tech/startup status.
- "non-X" for other groups (e.g. "non-finance") → emit the COMPLEMENT of that group in industry_groups.
- Do NOT emit both city and region for the same location. Pick one: city if user named a specific city ("San Francisco"); region if they used a Bay Area bucket ("East Bay").
- company_size_band remains available as a fallback but prefer company_tag="startup" — it's based on real company facts (funding, subsidiary status, age) rather than just headcount.
- "big tech"/"large company" → company_size_band "large"
- UWC school names → college (only set if user specifically mentions a UWC school)
- Undergrad / grad school names like "Berkeley alumni", "went to Stanford", "MIT grads" → university
- "from Brazil"/"Brazilian"/"Singapore origin" → origin
- Keywords capture ONLY substantive professional terms (e.g. "product management", "impact investing"). Never emit as keywords: generic quantity words ("people", "alumni", "folks", "professionals", "leaders") or event-format words ("dinner", "meetup", "event", "networking").

Do NOT invent filters unsupported by the input. When in doubt, leave null / empty.`;
}

function normalizeSearch(raw: unknown): SearchParseResult {
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

  const validSizes: CompanySizeBand[] = ["startup", "large"];
  const companySizeBand =
    typeof r.company_size_band === "string" && (validSizes as string[]).includes(r.company_size_band)
      ? (r.company_size_band as CompanySizeBand)
      : null;

  const validRegions = ["SF", "East Bay", "Peninsula", "South Bay", "North Bay"];
  const region =
    typeof r.region === "string" && validRegions.includes(r.region) ? r.region : null;

  const validTags: ParsedSearchQuery["companyTag"][] = ["tech", "non_tech", "startup", "not_startup"];
  const companyTag =
    typeof r.company_tag === "string" && (validTags as string[]).includes(r.company_tag)
      ? (r.company_tag as ParsedSearchQuery["companyTag"])
      : null;

  const validSectors = [
    "ai_research", "enterprise_saas", "consumer_tech", "developer_tools",
    "fintech", "biotech_research", "healthcare", "consulting", "academic",
    "government", "nonprofit", "finance", "media", "education", "energy",
    "industrial", "other",
  ];
  const sector =
    typeof r.sector === "string" && validSectors.includes(r.sector) ? r.sector : null;

  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  return {
    ok: true,
    parsed: {
      industryGroups,
      city: str(r.city),
      region,
      minGradYear: num(r.min_grad_year),
      maxGradYear: num(r.max_grad_year),
      companyName: str(r.company_name),
      companySizeBand,
      college: str(r.college),
      university: str(r.university),
      origin: str(r.origin),
      companyTag,
      sector,
      keywords: Array.isArray(r.keywords)
        ? r.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        : [],
    },
  };
}

/**
 * Parse a free-text alumni search query (no event-planning context).
 * Returns ok:false if the API key is missing or the call fails.
 */
export async function parseSearchQuery(query: string): Promise<SearchParseResult> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, error: "Empty query" };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY not set" };
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      temperature: 0,
      system: searchSystemPrompt(new Date().getFullYear()),
      messages: [{ role: "user", content: `Parse this search query: "${trimmed}"` }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const jsonSlice = isJsonParsable(text);
    if (!jsonSlice) return { ok: false, error: "No JSON in parser response" };
    const raw = JSON.parse(jsonSlice);
    return normalizeSearch(raw);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "parse failed" };
  }
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
      temperature: 0,
      system: eventSystemPrompt(new Date().getFullYear()),
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
