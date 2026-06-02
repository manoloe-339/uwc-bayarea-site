import { sql } from "./db";

/** Fields we diff between the inbound signup payload and the pre-existing
 * alumni row. Selected to match what the signup form accepts — anything
 * the user can type is here. Things populated by enrichment / admin
 * tooling only (e.g. headline, current_company) are intentionally NOT
 * here: re-signup is about what the user typed, not what we filled in
 * for them. */
export const DIFFED_FIELDS = [
  "first_name",
  "last_name",
  "mobile",
  "linkedin_url",
  "origin",
  "uwc_college",
  "grad_year",
  "current_city",
  "affiliation",
  "company",
  "help_tags",
  "national_committee",
  "about",
  "questions",
  "studying",
  "study_location",
  "working",
  "work_location",
  "parent_of_name",
  "parent_of_uwc_college",
  "parent_of_grad_year",
  "how_heard",
] as const;

export type DiffedField = (typeof DIFFED_FIELDS)[number];

export type FieldChange = {
  /** Pre-existing value on the alumni row before the upsert (null if absent). */
  from: string | number | null;
  /** Value the user submitted in this re-signup. */
  to: string | number | null;
  /** Whether the upsert actually wrote the new value.
   * The signup upsert now trusts user input: non-null submissions
   * overwrite. Exception: uwc_college is preserve-only (admin-curated
   * canonical names beat user typos). */
  applied: boolean;
};

/** Fields where existing (admin-curated) data wins over user re-submission.
 * Everything else flips to "user input wins when non-null." */
const PRESERVE_ON_CONFLICT: ReadonlySet<DiffedField> = new Set<DiffedField>([
  "uwc_college",
]);

export type SubmissionDiff = Partial<Record<DiffedField, FieldChange>>;

type RecordableRow = Partial<Record<DiffedField, string | number | null>>;

/** Compute a field-by-field diff between an inbound signup payload and
 * the alumni row as it existed BEFORE the upsert. Only fields that
 * differ AND that the user actively submitted are included — blank-on-
 * resubmit is noise (the user just didn't bother to re-enter a field),
 * not a meaningful change to surface. */
export function computeSignupDiff(
  payload: RecordableRow,
  previous: RecordableRow | null,
): SubmissionDiff {
  const diff: SubmissionDiff = {};
  for (const field of DIFFED_FIELDS) {
    const submitted = normalize(payload[field] ?? null);
    const existing = normalize(previous ? (previous[field] ?? null) : null);
    if (submitted === existing) continue;
    // Drop "user left this blank" entries — most re-signups don't fill
    // in every field, so emitting null-from-non-null pairs as "changes"
    // would drown the queue in noise.
    if (submitted === null) continue;
    const applied = PRESERVE_ON_CONFLICT.has(field)
      ? existing === null // preserve-on-conflict: user value only applies if no prior value
      : true; // default: user-submitted value wins (matches the upsert)
    diff[field] = {
      from: existing as FieldChange["from"],
      to: submitted as FieldChange["to"],
      applied,
    };
  }
  return diff;
}

function normalize(v: string | number | null | undefined): string | number | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}

/** Persist a signup submission record. Fire-and-forget at the call site
 * — failures here should not break the signup flow. */
export async function recordSignupSubmission(args: {
  alumni_id: number;
  payload: RecordableRow;
  diff: SubmissionDiff;
  is_resubmission: boolean;
}): Promise<void> {
  await sql`
    INSERT INTO signup_submissions (
      alumni_id, payload, diff, is_resubmission, status
    ) VALUES (
      ${args.alumni_id},
      ${JSON.stringify(args.payload)}::jsonb,
      ${JSON.stringify(args.diff)}::jsonb,
      ${args.is_resubmission},
      'unread'
    )
  `;
}

export type SignupSubmissionRow = {
  id: number;
  alumni_id: number;
  submitted_at: Date;
  payload: RecordableRow;
  diff: SubmissionDiff;
  is_resubmission: boolean;
  status: "unread" | "read" | "dismissed";
  reviewed_at: Date | null;
  reviewed_by: string | null;
  // Joined alumni fields
  alum_first_name: string | null;
  alum_last_name: string | null;
  alum_email: string | null;
  alum_uwc_college: string | null;
  alum_grad_year: number | null;
};

/** Read submissions for the admin queue. Defaults to unread
 * re-submissions only — the case the admin actually cares about. */
export async function listSignupSubmissions(
  filter: { onlyUnreadResubmissions?: boolean } = { onlyUnreadResubmissions: true },
): Promise<SignupSubmissionRow[]> {
  const whereParts: string[] = [];
  if (filter.onlyUnreadResubmissions ?? true) {
    whereParts.push("ss.is_resubmission = TRUE");
    whereParts.push("ss.status = 'unread'");
  }
  const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const rows = (await sql.query(`
    SELECT ss.*,
           a.first_name AS alum_first_name,
           a.last_name  AS alum_last_name,
           a.email      AS alum_email,
           a.uwc_college AS alum_uwc_college,
           a.grad_year  AS alum_grad_year
    FROM signup_submissions ss
    LEFT JOIN alumni a ON a.id = ss.alumni_id
    ${where}
    ORDER BY ss.submitted_at DESC
    LIMIT 200
  `)) as SignupSubmissionRow[];
  return rows;
}

export async function countUnreadResubmissions(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM signup_submissions
    WHERE is_resubmission = TRUE AND status = 'unread'
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function setSubmissionStatus(
  id: number,
  status: "read" | "dismissed",
): Promise<void> {
  await sql`
    UPDATE signup_submissions
    SET status = ${status}, reviewed_at = NOW()
    WHERE id = ${id}
  `;
}
