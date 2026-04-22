import { sql } from "./db";
import {
  classifyCompany,
  CLASSIFIER_MODEL,
  type CompanyClassificationInput,
} from "./company-classifier";

export type CompanyRow = {
  company_name: string;
  company_key: string;
  alumni_count: number;
  industry: string | null;
  size: string | null;
  website: string | null;
  linkedin_url: string | null;
  // classification fields (null when not yet classified)
  is_tech: boolean | null;
  is_startup: boolean | null;
  sector: string | null;
  confidence: number | null;
  reasoning: string | null;
  classified_at: string | null;
  needs_review: boolean;
};

export function normalizeCompanyKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * List every distinct company currently referenced by an alumni row, with
 * the best available metadata and (if present) its classification.
 * One row per unique company_key.
 */
export async function listCompaniesWithClassifications(): Promise<CompanyRow[]> {
  const rows = (await sql`
    WITH companies AS (
      SELECT
        lower(trim(current_company))                     AS company_key,
        MAX(current_company)                             AS company_name,
        COUNT(*)::int                                    AS alumni_count,
        MAX(current_company_industry)                    AS industry,
        MAX(current_company_size)                        AS size,
        MAX(current_company_website)                     AS website,
        MAX(current_company_linkedin)                    AS linkedin_url
      FROM alumni
      WHERE current_company IS NOT NULL AND trim(current_company) <> ''
      GROUP BY lower(trim(current_company))
    )
    SELECT c.company_name, c.company_key, c.alumni_count, c.industry, c.size,
           c.website, c.linkedin_url,
           cc.is_tech, cc.is_startup, cc.sector, cc.confidence, cc.reasoning,
           cc.classified_at, COALESCE(cc.needs_review, FALSE) AS needs_review
    FROM companies c
    LEFT JOIN company_classifications cc ON cc.company_key = c.company_key
    ORDER BY c.alumni_count DESC, c.company_name ASC
  `) as CompanyRow[];
  return rows;
}

export async function getUnclassifiedCount(): Promise<number> {
  const rows = (await sql`
    WITH companies AS (
      SELECT DISTINCT lower(trim(current_company)) AS company_key
      FROM alumni
      WHERE current_company IS NOT NULL AND trim(current_company) <> ''
    )
    SELECT COUNT(*)::int AS n
    FROM companies c
    LEFT JOIN company_classifications cc ON cc.company_key = c.company_key
    WHERE cc.id IS NULL
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function upsertClassification(params: {
  companyKey: string;
  companyName: string;
  isTech: boolean;
  isStartup: boolean;
  sector: string;
  confidence: number;
  reasoning: string;
  model: string;
}): Promise<void> {
  const needsReview = params.confidence < 0.6;
  await sql`
    INSERT INTO company_classifications (
      company_key, company_name, is_tech, is_startup,
      sector, confidence, reasoning, model,
      needs_review, classified_at, updated_at
    ) VALUES (
      ${params.companyKey}, ${params.companyName},
      ${params.isTech}, ${params.isStartup},
      ${params.sector}, ${params.confidence}, ${params.reasoning},
      ${params.model}, ${needsReview}, NOW(), NOW()
    )
    ON CONFLICT (company_key) DO UPDATE SET
      company_name  = EXCLUDED.company_name,
      is_tech       = EXCLUDED.is_tech,
      is_startup    = EXCLUDED.is_startup,
      sector        = EXCLUDED.sector,
      confidence    = EXCLUDED.confidence,
      reasoning     = EXCLUDED.reasoning,
      model         = EXCLUDED.model,
      needs_review  = EXCLUDED.needs_review,
      classified_at = NOW(),
      updated_at    = NOW()
  `;
}

/**
 * Classify a batch of companies. `onlyUnclassified=true` skips anything that
 * already has a classification row. Progress is reported via the callback
 * (for streaming / incremental UI if we later want it).
 */
export async function classifyAll(opts: {
  onlyUnclassified: boolean;
  limit?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number, companyName: string) => void;
}): Promise<{ classified: number; failed: number; skipped: number }> {
  const companies = await listCompaniesWithClassifications();
  const targets = opts.onlyUnclassified
    ? companies.filter((c) => c.classified_at == null)
    : companies;
  const list = opts.limit ? targets.slice(0, opts.limit) : targets;
  const total = list.length;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 5, 10));
  let classified = 0;
  let failed = 0;

  // Simple worker-pool: slice `list` into concurrency-sized chunks, process
  // each chunk in parallel, then move to the next. Keeps things simple and
  // avoids runaway Anthropic API concurrency.
  let cursor = 0;
  const next = () => (cursor < list.length ? list[cursor++] : null);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (true) {
          const c = next();
          if (!c) return;
          const input: CompanyClassificationInput = {
            name: c.company_name,
            industry: c.industry,
            size: c.size,
            website: c.website,
            linkedinUrl: c.linkedin_url,
          };
          const res = await classifyCompany(input);
          if (res.ok) {
            await upsertClassification({
              companyKey: c.company_key,
              companyName: c.company_name,
              ...res.data,
              model: CLASSIFIER_MODEL,
            });
            classified++;
          } else {
            failed++;
          }
          opts.onProgress?.(classified + failed, total, c.company_name);
        }
      })()
    );
  }
  await Promise.all(workers);
  return { classified, failed, skipped: companies.length - list.length };
}
