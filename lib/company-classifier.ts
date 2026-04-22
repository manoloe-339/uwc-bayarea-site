import Anthropic from "@anthropic-ai/sdk";

export type CompanyClassificationInput = {
  name: string;
  industry?: string | null;
  size?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
};

export type CompanyClassificationOutput = {
  isTech: boolean;
  isStartup: boolean;
  isPublic: boolean;
  isSubsidiary: boolean;
  parentCompany: string | null;
  sector: string;
  confidence: number;
  reasoning: string;
};

export type ClassifyResult =
  | { ok: true; data: CompanyClassificationOutput }
  | { ok: false; error: string };

const MODEL = "claude-haiku-4-5-20251001";

const VALID_SECTORS = [
  "ai_research",
  "enterprise_saas",
  "consumer_tech",
  "developer_tools",
  "fintech",
  "biotech_research",
  "healthcare",
  "consulting",
  "academic",
  "government",
  "nonprofit",
  "finance",
  "media",
  "education",
  "energy",
  "industrial",
  "other",
] as const;

function systemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `TODAY IS ${today}. You are classifying a company for an alumni database. Use your general knowledge of the company, not just the LinkedIn industry label (which is often misleading — LinkedIn tags Anthropic as "Research Services", for instance).

Return ONLY JSON, no prose, matching this shape:
{
  "is_tech": boolean,          // Primary business is building software/hardware products OR the company is culturally "tech". Anthropic=yes, OpenAI=yes, SoFi=yes (fintech is tech), Stripe=yes, Berkeley Lab=no, Bain=no, UNICEF=no.
  "is_startup": boolean,       // Privately held, generally <10 years old, VC/founder-funded, not a subsidiary of a larger entity, typically under a few hundred employees. Anthropic=yes (Series C-funded AI lab). Google=no (public, decades old). Xbox Media Solutions=no (Microsoft subsidiary). SoFi=no (public since 2021).
  "is_public": boolean,        // Publicly traded on a stock exchange today.
  "is_subsidiary": boolean,    // Majority-owned by a larger entity.
  "parent_company": string|null, // Name of the parent if is_subsidiary=true, else null.
  "sector": one of "ai_research"|"enterprise_saas"|"consumer_tech"|"developer_tools"|"fintech"|"biotech_research"|"healthcare"|"consulting"|"academic"|"government"|"nonprofit"|"finance"|"media"|"education"|"energy"|"industrial"|"other",
  "confidence": number 0-1,    // How confident you are. Lower this when the company is obscure or the name is ambiguous.
  "reasoning": string          // One sentence, <200 chars, why you classified it this way.
}

Rules:
- If you genuinely don't know the company, set confidence low (<0.6) and reasoning to "Unknown company — best guess from name/industry".
- Fintechs count as tech (is_tech=true).
- Microsoft, Google, Meta, Apple, Amazon, Netflix = NOT startups even if the LinkedIn subsidiary page shows small headcount.
- National labs, universities, med schools, teaching hospitals = NOT tech (even with a "Research" LinkedIn tag).
- VC firms and hedge funds = NOT tech (they're finance).
- Early-stage bio companies (pre-IPO biotech, <200 staff) = is_startup=true but is_tech=debatable; use sector="biotech_research" and mark is_tech=true only if their product is explicitly software-driven (e.g. a bioinformatics platform).`;
}

function isJsonSlice(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function userMessage(c: CompanyClassificationInput): string {
  const fields = [
    `name: ${c.name}`,
    c.industry ? `linkedin_industry: ${c.industry}` : null,
    c.size ? `size: ${c.size}` : null,
    c.website ? `website: ${c.website}` : null,
    c.linkedinUrl ? `linkedin: ${c.linkedinUrl}` : null,
  ].filter(Boolean);
  return `Classify this company:\n${fields.join("\n")}`;
}

export async function classifyCompany(
  c: CompanyClassificationInput
): Promise<ClassifyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY not set" };

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: systemPrompt(),
      messages: [{ role: "user", content: userMessage(c) }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const slice = isJsonSlice(text);
    if (!slice) return { ok: false, error: "No JSON in response" };
    const raw = JSON.parse(slice);
    if (!raw || typeof raw !== "object") return { ok: false, error: "Non-object" };
    const r = raw as Record<string, unknown>;

    const sector =
      typeof r.sector === "string" && (VALID_SECTORS as readonly string[]).includes(r.sector)
        ? r.sector
        : "other";
    const conf =
      typeof r.confidence === "number" && r.confidence >= 0 && r.confidence <= 1
        ? r.confidence
        : 0;
    return {
      ok: true,
      data: {
        isTech: r.is_tech === true,
        isStartup: r.is_startup === true,
        isPublic: r.is_public === true,
        isSubsidiary: r.is_subsidiary === true,
        parentCompany: typeof r.parent_company === "string" && r.parent_company.trim() ? r.parent_company.trim() : null,
        sector,
        confidence: conf,
        reasoning: typeof r.reasoning === "string" ? r.reasoning.slice(0, 400) : "",
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "classify failed" };
  }
}

export const CLASSIFIER_MODEL = MODEL;
