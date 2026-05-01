import { sql } from "./db";
import {
  VOLUNTEER_AREAS,
  type AlumniLookupResult,
  type VolunteerArea,
} from "./volunteer-signups-shared";

// Re-export so existing server-side imports keep working.
export { VOLUNTEER_AREAS };
export type { AlumniLookupResult, VolunteerArea };

/**
 * Lightweight match used by the public Help Out form. Email match wins
 * (case-insensitive); name match is exact-but-case/diacritic-insensitive
 * on first + last together. Deliberately not fuzzy — bad matches are
 * worse than no match because the user thinks we have them when we don't.
 */
export async function lookupAlumniForHelpOut(params: {
  name: string;
  email: string;
}): Promise<AlumniLookupResult> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();

  if (email && /.+@.+\..+/.test(email)) {
    const rows = (await sql`
      SELECT id, first_name, last_name, uwc_college, grad_year
      FROM alumni
      WHERE deceased IS NOT TRUE
        AND lower(email) = ${email}
      LIMIT 1
    `) as Array<{
      id: number;
      first_name: string | null;
      last_name: string | null;
      uwc_college: string | null;
      grad_year: number | null;
    }>;
    if (rows[0]) {
      return {
        status: "match",
        member: {
          id: rows[0].id,
          name: [rows[0].first_name, rows[0].last_name].filter(Boolean).join(" ").trim(),
          school: rows[0].uwc_college,
          year: rows[0].grad_year,
        },
      };
    }
  }

  if (name.length >= 3) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts.slice(1).join(" ");
      const rows = (await sql`
        SELECT id, first_name, last_name, uwc_college, grad_year
        FROM alumni
        WHERE deceased IS NOT TRUE
          AND unaccent(lower(COALESCE(first_name, ''))) = unaccent(lower(${first}))
          AND unaccent(lower(COALESCE(last_name, ''))) = unaccent(lower(${last}))
        LIMIT 1
      `) as Array<{
        id: number;
        first_name: string | null;
        last_name: string | null;
        uwc_college: string | null;
        grad_year: number | null;
      }>;
      if (rows[0]) {
        return {
          status: "match",
          member: {
            id: rows[0].id,
            name: [rows[0].first_name, rows[0].last_name].filter(Boolean).join(" ").trim(),
            school: rows[0].uwc_college,
            year: rows[0].grad_year,
          },
        };
      }
    }
  }

  return { status: "nomatch" };
}

export interface VolunteerSignupRow {
  id: number;
  alumni_id: number | null;
  submitted_name: string;
  submitted_email: string;
  areas: VolunteerArea[];
  national_committee_choice: string | null;
  note: string | null;
  contacted_at: string | null;
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
}): Promise<VolunteerSignupRow> {
  const rows = (await sql`
    INSERT INTO volunteer_signups (
      alumni_id, submitted_name, submitted_email, areas,
      national_committee_choice, note
    ) VALUES (
      ${data.alumniId},
      ${data.submittedName},
      ${data.submittedEmail},
      ${data.areas},
      ${data.nationalCommitteeChoice},
      ${data.note}
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
