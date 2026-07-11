import { sql } from "./db";

/** Count alumni at a given canonical UWC college. Excludes deceased
 * rows and (optionally) one row by id — used to exclude the new signup
 * themselves so the count reads "N others". */
export async function fetchCollegeAlumniCount(
  college: string,
  excludeId?: number,
): Promise<number> {
  const rows =
    excludeId != null
      ? ((await sql`
          SELECT COUNT(*)::int AS n FROM alumni
          WHERE uwc_college = ${college}
            AND deceased IS NOT TRUE
            AND NOT ('admin_added' = ANY(sources))
            AND id <> ${excludeId}
        `) as { n: number }[])
      : ((await sql`
          SELECT COUNT(*)::int AS n FROM alumni
          WHERE uwc_college = ${college}
            AND deceased IS NOT TRUE
            AND NOT ('admin_added' = ANY(sources))
        `) as { n: number }[]);
  return rows[0]?.n ?? 0;
}

/** Human-readable sentence describing how many other alumni share the
 * new signup's college. Returns "" when no college is known so the
 * placeholder collapses cleanly. */
export function buildCollegeBlurb(college: string | null, count: number): string {
  if (!college) return "";
  if (count <= 0) {
    return `You're the first alum from ${college} in our network — welcome!`;
  }
  if (count === 1) {
    return `You're joining 1 other ${college} alum already in our network.`;
  }
  return `You're joining ${count} other ${college} alumni already in our network.`;
}

/** Count other alumni at the same company. Prefers an exact LinkedIn
 * company-URL match (the strongest canonical key — both rows
 * originate from the same enrichment pipeline so format is
 * consistent), falls back to a lower-trimmed name match on
 * current_company. Excludes deceased and admin-added rows, plus the
 * new signup themselves. */
export async function fetchCompanyAlumniCount(
  currentCompanyLinkedin: string | null,
  currentCompany: string | null,
  excludeId?: number,
): Promise<number> {
  // Nothing to match against → zero. Caller will skip the blurb.
  if (!currentCompanyLinkedin && !currentCompany) return 0;

  if (currentCompanyLinkedin) {
    const slug = currentCompanyLinkedin.trim().toLowerCase();
    const rows =
      excludeId != null
        ? ((await sql`
            SELECT COUNT(*)::int AS n FROM alumni
            WHERE LOWER(TRIM(current_company_linkedin)) = ${slug}
              AND deceased IS NOT TRUE
              AND NOT ('admin_added' = ANY(sources))
              AND id <> ${excludeId}
          `) as { n: number }[])
        : ((await sql`
            SELECT COUNT(*)::int AS n FROM alumni
            WHERE LOWER(TRIM(current_company_linkedin)) = ${slug}
              AND deceased IS NOT TRUE
              AND NOT ('admin_added' = ANY(sources))
          `) as { n: number }[]);
    return rows[0]?.n ?? 0;
  }

  const name = currentCompany!.trim().toLowerCase();
  const rows =
    excludeId != null
      ? ((await sql`
          SELECT COUNT(*)::int AS n FROM alumni
          WHERE LOWER(TRIM(current_company)) = ${name}
            AND deceased IS NOT TRUE
            AND NOT ('admin_added' = ANY(sources))
            AND id <> ${excludeId}
        `) as { n: number }[])
      : ((await sql`
          SELECT COUNT(*)::int AS n FROM alumni
          WHERE LOWER(TRIM(current_company)) = ${name}
            AND deceased IS NOT TRUE
            AND NOT ('admin_added' = ANY(sources))
        `) as { n: number }[]);
  return rows[0]?.n ?? 0;
}

/** Human-readable sentence describing how many other UWC alumni work
 * at the new signup's current company. Returns "" when company is
 * unknown OR count is zero — both are graceful-collapse cases (we
 * never want to send "You're the first UWC alum at <Company>" because
 * absence of enrichment data is indistinguishable from "really alone"). */
export function buildCompanyBlurb(company: string | null, count: number): string {
  if (!company || count <= 0) return "";
  if (count === 1) {
    return `You're joining 1 other UWC alum at ${company}.`;
  }
  return `You're joining ${count} other UWC alumni at ${company}.`;
}

/** A trimmed alumni row for admin notifications: enough to identify
 * the person, their UWC school, and reach out via LinkedIn. */
export type CompanyMatch = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  linkedin_url: string | null;
  uwc_college: string | null;
  grad_year: number | null;
};

/** Fetch the actual list of other UWC alumni at the same company (up
 * to `limit`), most-recently-active first. Uses the same match logic
 * as fetchCompanyAlumniCount — LinkedIn slug preferred, name fallback,
 * excludes deceased / admin-added rows and the new signup themselves.
 *
 * Returns [] when nothing to match against or on any query failure. */
export async function fetchCompanyAlumniList(
  currentCompanyLinkedin: string | null,
  currentCompany: string | null,
  excludeId: number,
  limit = 15,
): Promise<CompanyMatch[]> {
  if (!currentCompanyLinkedin && !currentCompany) return [];
  if (currentCompanyLinkedin) {
    const slug = currentCompanyLinkedin.trim().toLowerCase();
    return (await sql`
      SELECT id, first_name, last_name, linkedin_url, uwc_college, grad_year
        FROM alumni
       WHERE LOWER(TRIM(current_company_linkedin)) = ${slug}
         AND deceased IS NOT TRUE
         AND NOT ('admin_added' = ANY(sources))
         AND id <> ${excludeId}
       ORDER BY updated_at DESC NULLS LAST
       LIMIT ${limit}
    `) as CompanyMatch[];
  }
  const name = currentCompany!.trim().toLowerCase();
  return (await sql`
    SELECT id, first_name, last_name, linkedin_url, uwc_college, grad_year
      FROM alumni
     WHERE LOWER(TRIM(current_company)) = ${name}
       AND deceased IS NOT TRUE
       AND NOT ('admin_added' = ANY(sources))
       AND id <> ${excludeId}
     ORDER BY updated_at DESC NULLS LAST
     LIMIT ${limit}
  `) as CompanyMatch[];
}

/** Substitute {college}, {college_count}, {college_blurb},
 *  {company}, {company_count}, {company_blurb}, and {whatsapp_link}
 *  in the confirmation markdown body. Unknown {placeholders} are
 *  left as-is. */
export function applyConfirmationPlaceholders(
  md: string,
  ctx: {
    college: string | null;
    collegeCount: number;
    /** LinkedIn-canonical company name (alumni.current_company), only
     *  populated when enrichment succeeded. When null, all {company_*}
     *  placeholders collapse to empty. */
    company?: string | null;
    companyCount?: number;
    /** Optional fully-qualified URL with a signed token, e.g.
     *  "https://uwcbayarea.org/join-whatsapp?invite=...". When set,
     *  {whatsapp_link} substitutes to this URL; when omitted it
     *  falls back to a generic /join-whatsapp link so the preview
     *  rendering in the admin tool still produces a valid URL. */
    whatsappLink?: string;
  },
): string {
  const whatsappLink =
    ctx.whatsappLink ?? "https://uwcbayarea.org/join-whatsapp";
  const company = ctx.company ?? null;
  const companyCount = ctx.companyCount ?? 0;
  return md
    .replaceAll("{college_blurb}", buildCollegeBlurb(ctx.college, ctx.collegeCount))
    .replaceAll("{college_count}", String(ctx.collegeCount))
    .replaceAll("{college}", ctx.college ?? "")
    .replaceAll("{company_blurb}", buildCompanyBlurb(company, companyCount))
    .replaceAll("{company_count}", String(companyCount))
    .replaceAll("{company}", company ?? "")
    .replaceAll("{whatsapp_link}", whatsappLink);
}

/** If the body has no blank lines but multiple text lines, the author
 * almost certainly meant each line to be its own paragraph (typical
 * one-Enter-per-paragraph muscle memory). Promote single newlines to
 * blank lines so the markdown renderer paragraph-breaks them.
 *
 * If the body already contains a blank line, the author understands
 * paragraph syntax — leave it alone so intentional `<br>` soft breaks
 * (e.g. multi-line signoffs) keep working. */
export function ensureParagraphBreaks(md: string): string {
  if (md.includes("\n\n")) return md;
  return md.replace(/\n/g, "\n\n");
}
