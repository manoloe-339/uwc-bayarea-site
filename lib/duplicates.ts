import { sql } from "./db";

export type DuplicateMember = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  linkedin_url: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  submitted_at: string | null;
  current_title: string | null;
  current_company: string | null;
  current_city: string | null;
  photo_url: string | null;
  deceased: boolean | null;
  // aggregates
  career_count: number;
  edu_count: number;
  vol_count: number;
  send_count: number;
};

export type DuplicateGroup = {
  /** Unique key for the group (signal + value). */
  key: string;
  /** What caused the group to form — same LinkedIn URL, same full name, etc. */
  signal: "linkedin_url" | "name";
  /** Human-readable label for the shared value. */
  signalLabel: string;
  members: DuplicateMember[];
};

/**
 * Find duplicate groups: rows sharing the same LinkedIn URL, OR the same
 * lowercase-trimmed first+last name. If a group shows up under both signals,
 * only the LinkedIn-URL version is kept (stronger signal).
 */
export async function findDuplicates(): Promise<DuplicateGroup[]> {
  const liGroups = (await sql`
    SELECT linkedin_url, array_agg(id ORDER BY id) AS ids
    FROM alumni
    WHERE linkedin_url IS NOT NULL AND trim(linkedin_url) <> ''
    GROUP BY linkedin_url
    HAVING COUNT(*) > 1
  `) as { linkedin_url: string; ids: number[] }[];

  const nameGroups = (await sql`
    SELECT
      lower(trim(first_name)) || '|' || lower(trim(last_name)) AS key,
      max(first_name || ' ' || last_name) AS label,
      array_agg(id ORDER BY id) AS ids
    FROM alumni
    WHERE first_name IS NOT NULL AND last_name IS NOT NULL
      AND trim(first_name) <> '' AND trim(last_name) <> ''
    GROUP BY lower(trim(first_name)), lower(trim(last_name))
    HAVING COUNT(*) > 1
  `) as { key: string; label: string; ids: number[] }[];

  // Track which IDs are already covered by a LinkedIn group so we don't
  // surface the same pair twice under the weaker "same name" signal.
  const covered = new Set<number>();
  const groups: DuplicateGroup[] = [];

  for (const g of liGroups) {
    groups.push({
      key: `li:${g.linkedin_url}`,
      signal: "linkedin_url",
      signalLabel: g.linkedin_url,
      members: [], // filled below
    });
    for (const id of g.ids) covered.add(id);
  }
  for (const g of nameGroups) {
    const allCovered = g.ids.every((id) => covered.has(id));
    if (allCovered) continue;
    groups.push({
      key: `name:${g.key}`,
      signal: "name",
      signalLabel: g.label,
      members: [],
    });
    for (const id of g.ids) covered.add(id);
  }

  if (groups.length === 0) return [];

  // Fetch member details + child counts in one pass.
  const allIds = Array.from(covered);
  const rows = (await sql`
    SELECT a.id, a.first_name, a.last_name, a.email, a.linkedin_url,
           a.uwc_college, a.grad_year, a.submitted_at,
           a.current_title, a.current_company, a.current_city,
           a.photo_url, a.deceased,
           (SELECT COUNT(*)::int FROM alumni_career WHERE alumni_id = a.id) AS career_count,
           (SELECT COUNT(*)::int FROM alumni_education WHERE alumni_id = a.id) AS edu_count,
           (SELECT COUNT(*)::int FROM alumni_volunteering WHERE alumni_id = a.id) AS vol_count,
           (SELECT COUNT(*)::int FROM email_sends WHERE alumni_id = a.id) AS send_count
    FROM alumni a
    WHERE a.id = ANY(${allIds})
    ORDER BY a.id
  `) as DuplicateMember[];

  const rowsById = new Map<number, DuplicateMember>();
  for (const r of rows) rowsById.set(r.id, r);

  // Back-fill the members arrays in the order we first saw each group.
  for (const g of groups) {
    const ids =
      g.signal === "linkedin_url"
        ? (liGroups.find((lg) => `li:${lg.linkedin_url}` === g.key)?.ids ?? [])
        : (nameGroups.find((ng) => `name:${ng.key}` === g.key)?.ids ?? []);
    g.members = ids.map((id) => rowsById.get(id)).filter((m): m is DuplicateMember => !!m);
  }

  return groups;
}
