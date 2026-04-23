import type { AlumniRow } from "./alumni-query";
import { sql } from "./db";

export type MatchInfo = {
  label: string; // e.g. "Past role", "Undergrad", "Headline"
  snippet: string;
};

type CareerRow = { alumni_id: number; title: string | null; company: string | null };
type EduRow = { alumni_id: number; school: string | null; degree_field: string | null; is_uwc: boolean };
type VolRow = { alumni_id: number; role: string | null; organization: string | null };

function contains(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle);
}

/** Truncate a bio-length string to a ~120-char window around the matched term. */
function excerpt(text: string, needle: string, pad = 50): string {
  const idx = text.toLowerCase().indexOf(needle);
  if (idx < 0) return text.slice(0, 120);
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + needle.length + pad);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

/**
 * For each row, find the first *non-visible* field that matched the query.
 * Visible fields (name, uwc_college, grad_year, origin, current_city,
 * current_title, current_company) are skipped because they're already in
 * the results table columns — no point repeating them.
 */
export async function findSearchMatches(
  rows: AlumniRow[],
  q: string
): Promise<Map<number, MatchInfo>> {
  const out = new Map<number, MatchInfo>();
  const needle = q.trim().toLowerCase();
  if (!needle || rows.length === 0) return out;
  const pattern = `%${needle}%`;
  const ids = rows.map((r) => r.id);

  const [careerRowsRaw, eduRowsRaw, volRowsRaw] = await Promise.all([
    sql`
      SELECT alumni_id, title, company FROM alumni_career
      WHERE alumni_id = ANY(${ids})
        AND (lower(company) LIKE ${pattern} OR lower(title) LIKE ${pattern})
      ORDER BY position ASC
    `,
    sql`
      SELECT alumni_id, school, degree_field, is_uwc FROM alumni_education
      WHERE alumni_id = ANY(${ids})
        AND (lower(school) LIKE ${pattern} OR lower(degree_field) LIKE ${pattern})
      ORDER BY position ASC
    `,
    sql`
      SELECT alumni_id, role, organization FROM alumni_volunteering
      WHERE alumni_id = ANY(${ids})
        AND (lower(organization) LIKE ${pattern} OR lower(role) LIKE ${pattern})
    `,
  ]);
  const careerRows = careerRowsRaw as unknown as CareerRow[];
  const eduRows = eduRowsRaw as unknown as EduRow[];
  const volRows = volRowsRaw as unknown as VolRow[];

  const firstBy = <T extends { alumni_id: number }>(arr: T[]) => {
    const m = new Map<number, T>();
    for (const r of arr) if (!m.has(r.alumni_id)) m.set(r.alumni_id, r);
    return m;
  };
  const careerByAlum = firstBy(careerRows);
  const eduByAlum = firstBy(eduRows);
  const volByAlum = firstBy(volRows);

  for (const r of rows) {
    const info = detectMatch(
      r,
      needle,
      careerByAlum.get(r.id),
      eduByAlum.get(r.id),
      volByAlum.get(r.id)
    );
    if (info) out.set(r.id, info);
  }
  return out;
}

function detectMatch(
  row: AlumniRow,
  needle: string,
  career?: CareerRow,
  edu?: EduRow,
  vol?: VolRow
): MatchInfo | null {
  // Priority: surface the most informative non-visible match first.

  // 1) Past role — skip if the matched career entry is the current company
  //    (already visible in the Current company column).
  if (career) {
    const curCompany = (row.current_company ?? "").toLowerCase();
    const sameAsCurrent =
      career.company != null && career.company.toLowerCase() === curCompany;
    if (!sameAsCurrent) {
      const title = career.title ?? "";
      const company = career.company ?? "";
      const snippet = [title, company].filter(Boolean).join(" @ ");
      if (snippet) return { label: "Past role", snippet };
    }
  }

  // 2) Education — but only non-UWC (UWC column is already visible).
  if (edu && !edu.is_uwc) {
    const school = edu.school ?? "";
    const deg = edu.degree_field ?? "";
    const snippet = deg ? `${school} — ${deg}` : school;
    if (snippet) return { label: "Education", snippet };
  }

  // 3) Volunteering.
  if (vol) {
    const role = vol.role ?? "";
    const org = vol.organization ?? "";
    const snippet = role ? `${role} @ ${org}` : org;
    if (snippet) return { label: "Volunteering", snippet };
  }

  // 4) Alumni-row text fields. Priority roughly: short/definitive first,
  //    then longer bios.
  if (contains(row.headline, needle)) {
    return { label: "Headline", snippet: row.headline! };
  }
  if (contains(row.linkedin_alternate_email, needle)) {
    return { label: "Alt email", snippet: row.linkedin_alternate_email! };
  }
  if (contains(row.current_company_industry, needle)) {
    return { label: "Industry", snippet: row.current_company_industry! };
  }
  if (contains(row.location_full, needle)) {
    return { label: "LinkedIn location", snippet: row.location_full! };
  }
  if (contains(row.location_country, needle) && !contains(row.origin, needle)) {
    return { label: "LinkedIn country", snippet: row.location_country! };
  }
  // Long free-text fields — return an excerpt around the match.
  const r = row as AlumniRow & {
    linkedin_about?: string | null;
    about?: string | null;
    working?: string | null;
    studying?: string | null;
    help_tags?: string | null;
    questions?: string | null;
    national_committee?: string | null;
  };
  if (contains(r.linkedin_about, needle)) {
    return { label: "LinkedIn about", snippet: excerpt(r.linkedin_about!, needle) };
  }
  if (contains(r.about, needle)) {
    return { label: "About", snippet: excerpt(r.about!, needle) };
  }
  if (contains(r.working, needle)) {
    return { label: "Working", snippet: excerpt(r.working!, needle) };
  }
  if (contains(r.studying, needle)) {
    return { label: "Studying", snippet: excerpt(r.studying!, needle) };
  }
  if (contains(r.help_tags, needle)) {
    return { label: "Help tags", snippet: r.help_tags! };
  }
  if (contains(r.questions, needle)) {
    return { label: "Questions", snippet: excerpt(r.questions!, needle) };
  }
  if (contains(r.national_committee, needle)) {
    return { label: "National committee", snippet: r.national_committee! };
  }

  return null;
}
