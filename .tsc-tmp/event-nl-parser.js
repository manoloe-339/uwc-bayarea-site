import Anthropic from "@anthropic-ai/sdk";
import { INDUSTRY_GROUPS } from "./industry-groups";
function ageRules(thisYear) {
    return `- Age is expressed in YEARS OLD, but the database stores GRADUATION YEAR. UWC alumni graduate at ~18. Today's year is ${thisYear}. Map age → grad_year as: grad_year ≈ ${thisYear} - age + 18. Examples:
  - "35 years old" → ${thisYear - 35 + 18} (grad_year)
  - "40+" / "older than 40" → max_grad_year ${thisYear - 40 + 18}
  - "under 30" / "younger than 30" → min_grad_year ${thisYear - 30 + 18}
  - "senior alumni", "experienced", "older" without a number → max_grad_year 2010
  - "recent grads", "younger" without a number → min_grad_year 2018
- Do NOT set max_grad_year below 1990 — our oldest Bay Area alumni are mid-90s graduates. If age math would yield something before 1990, clip to 1990.
- Age filter and age diversity are MUTUALLY EXCLUSIVE — never both.`;
}
function eventSystemPrompt(thisYear) {
    return `You are an event planning assistant for a UWC Bay Area alumni network. Parse the user's event description into structured JSON.

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
function isJsonParsable(text) {
    // Strip markdown fences / leading prose, find the first JSON object.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start)
        return null;
    return text.slice(start, end + 1);
}
function normalize(raw) {
    if (!raw || typeof raw !== "object") {
        return { ok: false, error: "Parser returned non-object" };
    }
    const r = raw;
    const industryGroups = [];
    if (Array.isArray(r.industry_groups)) {
        for (const g of r.industry_groups) {
            if (typeof g === "string" && INDUSTRY_GROUPS.includes(g)) {
                industryGroups.push(g);
            }
        }
    }
    const diversityDimensions = [];
    const validDims = ["origin", "school", "region", "company", "age"];
    if (Array.isArray(r.diversity_dimensions)) {
        for (const d of r.diversity_dimensions) {
            if (typeof d === "string" && validDims.includes(d)) {
                diversityDimensions.push(d);
            }
        }
    }
    const validSizes = ["startup", "large"];
    const companySizeBand = typeof r.company_size_band === "string" && validSizes.includes(r.company_size_band)
        ? r.company_size_band
        : null;
    const validRegions = ["SF", "East Bay", "Peninsula", "South Bay", "North Bay"];
    const region = typeof r.region === "string" && validRegions.includes(r.region) ? r.region : null;
    const num = (v) => {
        if (typeof v === "number" && Number.isFinite(v))
            return v;
        return null;
    };
    const str = (v) => {
        if (typeof v === "string" && v.trim())
            return v.trim();
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
                ? r.keywords.filter((k) => typeof k === "string" && k.trim().length > 0)
                : [],
        },
    };
}
function searchSystemPrompt(thisYear) {
    return `You are an alumni search assistant for a UWC Bay Area alumni network. Parse the user's free-text search query into structured filters.

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
- "non-tech" / "not in tech" / "except tech" → the COMPLEMENT of the named group: emit all OTHER industry groups. Same for any "non-X" phrasing.
- Do NOT emit both city and region for the same location. Pick one: city if user named a specific city ("San Francisco"); region if they used a Bay Area bucket ("East Bay").
- "startup"/"early-stage" → company_size_band "startup"
- "big tech"/"large company" → company_size_band "large"
- UWC school names → college (only set if user specifically mentions a UWC school)
- Undergrad / grad school names like "Berkeley alumni", "went to Stanford", "MIT grads" → university
- "from Brazil"/"Brazilian"/"Singapore origin" → origin
- Keywords capture ONLY substantive professional terms (e.g. "product management", "impact investing"). Never emit as keywords: generic quantity words ("people", "alumni", "folks", "professionals", "leaders") or event-format words ("dinner", "meetup", "event", "networking").

Do NOT invent filters unsupported by the input. When in doubt, leave null / empty.`;
}
function normalizeSearch(raw) {
    if (!raw || typeof raw !== "object") {
        return { ok: false, error: "Parser returned non-object" };
    }
    const r = raw;
    const industryGroups = [];
    if (Array.isArray(r.industry_groups)) {
        for (const g of r.industry_groups) {
            if (typeof g === "string" && INDUSTRY_GROUPS.includes(g)) {
                industryGroups.push(g);
            }
        }
    }
    const validSizes = ["startup", "large"];
    const companySizeBand = typeof r.company_size_band === "string" && validSizes.includes(r.company_size_band)
        ? r.company_size_band
        : null;
    const validRegions = ["SF", "East Bay", "Peninsula", "South Bay", "North Bay"];
    const region = typeof r.region === "string" && validRegions.includes(r.region) ? r.region : null;
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
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
            keywords: Array.isArray(r.keywords)
                ? r.keywords.filter((k) => typeof k === "string" && k.trim().length > 0)
                : [],
        },
    };
}
/**
 * Parse a free-text alumni search query (no event-planning context).
 * Returns ok:false if the API key is missing or the call fails.
 */
export async function parseSearchQuery(query) {
    const trimmed = query.trim();
    if (!trimmed)
        return { ok: false, error: "Empty query" };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        return { ok: false, error: "ANTHROPIC_API_KEY not set" };
    try {
        const client = new Anthropic({ apiKey });
        const resp = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 600,
            system: searchSystemPrompt(new Date().getFullYear()),
            messages: [{ role: "user", content: `Parse this search query: "${trimmed}"` }],
        });
        const text = resp.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
        const jsonSlice = isJsonParsable(text);
        if (!jsonSlice)
            return { ok: false, error: "No JSON in parser response" };
        const raw = JSON.parse(jsonSlice);
        return normalizeSearch(raw);
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "parse failed" };
    }
}
/**
 * Parse a free-text event description into structured filters + event-mode
 * settings via Claude Haiku. Returns ok:false if the API key is missing, the
 * call fails, or the response isn't valid JSON — callers should fall back to
 * treating the query as a plain fuzzy-search `q`.
 */
export async function parseEventQuery(query) {
    const trimmed = query.trim();
    if (!trimmed)
        return { ok: false, error: "Empty query" };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        return { ok: false, error: "ANTHROPIC_API_KEY not set" };
    try {
        const client = new Anthropic({ apiKey });
        const resp = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 800,
            system: eventSystemPrompt(new Date().getFullYear()),
            messages: [{ role: "user", content: `Parse this event description: "${trimmed}"` }],
        });
        const text = resp.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
        const jsonSlice = isJsonParsable(text);
        if (!jsonSlice)
            return { ok: false, error: "No JSON in parser response" };
        const raw = JSON.parse(jsonSlice);
        return normalize(raw);
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "parse failed" };
    }
}
