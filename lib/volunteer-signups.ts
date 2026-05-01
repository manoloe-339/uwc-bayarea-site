import { sql } from "./db";
import {
  VOLUNTEER_AREAS,
  type VolunteerArea,
  type VolunteerMatchStatus,
  type VolunteerMatchConfidence,
} from "./volunteer-signups-shared";

// Re-export so existing server-side imports keep working.
export { VOLUNTEER_AREAS };
export type { VolunteerArea, VolunteerMatchStatus, VolunteerMatchConfidence };

export interface VolunteerSignupRow {
  id: number;
  alumni_id: number | null;
  submitted_name: string;
  submitted_email: string;
  areas: VolunteerArea[];
  national_committee_choice: string | null;
  note: string | null;
  contacted_at: string | null;
  match_status: VolunteerMatchStatus | null;
  match_confidence: VolunteerMatchConfidence | null;
  match_reason: string | null;
  matched_at: string | null;
  created_at: string;
  // Joined for display in admin
  alumni_first_name: string | null;
  alumni_last_name: string | null;
  alumni_uwc_college: string | null;
  alumni_grad_year: number | null;
}

export async function createVolunteerSignup(data: {
  alumniId: number | null;
  submittedName: string;
  submittedEmail: string;
  areas: VolunteerArea[];
  nationalCommitteeChoice: string | null;
  note: string | null;
  matchStatus: VolunteerMatchStatus;
  matchConfidence: VolunteerMatchConfidence | null;
  matchReason: string;
}): Promise<VolunteerSignupRow> {
  const matchedAt = data.alumniId != null ? new Date() : null;
  const rows = (await sql`
    INSERT INTO volunteer_signups (
      alumni_id, submitted_name, submitted_email, areas,
      national_committee_choice, note,
      match_status, match_confidence, match_reason, matched_at
    ) VALUES (
      ${data.alumniId},
      ${data.submittedName},
      ${data.submittedEmail},
      ${data.areas},
      ${data.nationalCommitteeChoice},
      ${data.note},
      ${data.matchStatus},
      ${data.matchConfidence},
      ${data.matchReason},
      ${matchedAt}
    )
    RETURNING *
  `) as VolunteerSignupRow[];
  return rows[0];
}

export async function listVolunteerSignups(): Promise<VolunteerSignupRow[]> {
  return (await sql`
    SELECT
      v.*,
      al.first_name AS alumni_first_name,
      al.last_name  AS alumni_last_name,
      al.uwc_college AS alumni_uwc_college,
      al.grad_year  AS alumni_grad_year
    FROM volunteer_signups v
    LEFT JOIN alumni al ON al.id = v.alumni_id
    ORDER BY v.created_at DESC, v.id DESC
  `) as VolunteerSignupRow[];
}

export async function setVolunteerSignupContacted(
  id: number,
  contacted: boolean
): Promise<void> {
  await sql`
    UPDATE volunteer_signups
    SET contacted_at = ${contacted ? new Date() : null}
    WHERE id = ${id}
  `;
}

/**
 * Manually attach (or clear) the alumni link on a volunteer signup.
 * Used by the admin UI when the auto-matcher couldn't pick a single
 * candidate or got it wrong. Bumps the match metadata to 'manual'.
 */
export async function setVolunteerSignupAlumni(
  id: number,
  alumniId: number | null
): Promise<void> {
  if (alumniId == null) {
    await sql`
      UPDATE volunteer_signups
      SET alumni_id = NULL,
          match_status = 'unmatched',
          match_confidence = NULL,
          match_reason = 'Manually unlinked',
          matched_at = NULL
      WHERE id = ${id}
    `;
    return;
  }
  await sql`
    UPDATE volunteer_signups
    SET alumni_id = ${alumniId},
        match_status = 'matched',
        match_confidence = 'manual',
        match_reason = 'Manually linked',
        matched_at = NOW()
    WHERE id = ${id}
  `;
}

/** Lightweight alumni search for the manual-link UI in admin. */
export interface AlumniSearchHit {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
}

export async function searchAlumniForVolunteerLink(
  query: string,
  limit = 10
): Promise<AlumniSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q.toLowerCase()}%`;
  return (await sql`
    SELECT id, first_name, last_name, email, uwc_college, grad_year
    FROM alumni
    WHERE deceased IS NOT TRUE
      AND (
        lower(email) LIKE ${like}
        OR unaccent(lower(COALESCE(first_name, ''))) LIKE unaccent(${like})
        OR unaccent(lower(COALESCE(last_name, ''))) LIKE unaccent(${like})
        OR unaccent(lower(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) LIKE unaccent(${like})
      )
    ORDER BY last_name ASC NULLS LAST, first_name ASC NULLS LAST
    LIMIT ${limit}
  `) as AlumniSearchHit[];
}
