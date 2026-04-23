import { sql } from "./db";

export type StripeAttendeeHint = {
  email: string | null;
  name: string | null;
  /** Optional UWC college name collected via Payment Link custom field. */
  uwcCollege: string | null;
};

export type MatchStatus = "matched" | "needs_review" | "unmatched";
export type MatchConfidence = "high" | "medium" | "low" | "manual";

export type MatchResult = {
  alumniId: number | null;
  matchStatus: MatchStatus;
  matchConfidence: MatchConfidence | null;
  matchReason: string;
  /** Optional alternate candidates when the match is ambiguous — used by
      the review UI to show "other possible matches". */
  otherCandidateIds: number[];
};

/**
 * Find the alumni row that best matches a Stripe payment. Priority order:
 *
 *   1. Exact email on alumni.email → high
 *   2. Exact email on alumni.linkedin_alternate_email → high
 *   3. First + last name + UWC college (if college provided) → medium review
 *   4. First + last name with a single hit → medium review
 *   5. Multiple name hits → low, needs review, carries all candidates
 *   6. No hits → unmatched
 *
 * Name matching uses ILIKE against first_name AND last_name — double-barrel
 * last names fall back to comparing just the final word (naive for v1).
 * Deceased rows are excluded.
 */
export async function matchAlumniForAttendee(hint: StripeAttendeeHint): Promise<MatchResult> {
  const email = (hint.email ?? "").trim().toLowerCase();
  if (email) {
    const rows = (await sql`
      SELECT id FROM alumni
      WHERE deceased IS NOT TRUE AND lower(email) = ${email}
      LIMIT 1
    `) as { id: number }[];
    if (rows[0]) {
      return {
        alumniId: rows[0].id,
        matchStatus: "matched",
        matchConfidence: "high",
        matchReason: "Email match",
        otherCandidateIds: [],
      };
    }

    const altRows = (await sql`
      SELECT id FROM alumni
      WHERE deceased IS NOT TRUE AND lower(linkedin_alternate_email) = ${email}
      LIMIT 1
    `) as { id: number }[];
    if (altRows[0]) {
      return {
        alumniId: altRows[0].id,
        matchStatus: "matched",
        matchConfidence: "high",
        matchReason: "Alternate email match",
        otherCandidateIds: [],
      };
    }
  }

  const { first, last } = parseName(hint.name);
  if (!first && !last) {
    return noMatch("No name or email to match on");
  }

  const firstLike = first ? `%${first}%` : "%";
  const lastLike = last ? `%${last}%` : "%";

  // Tier 3: name + college. Requires both a usable name and a college hint.
  if (hint.uwcCollege && first && last) {
    const collegeLike = `%${hint.uwcCollege.trim().toLowerCase()}%`;
    const rows = (await sql`
      SELECT id FROM alumni
      WHERE deceased IS NOT TRUE
        AND lower(first_name) LIKE ${firstLike}
        AND lower(last_name) LIKE ${lastLike}
        AND lower(uwc_college) LIKE ${collegeLike}
      LIMIT 5
    `) as { id: number }[];
    if (rows.length === 1) {
      return {
        alumniId: rows[0].id,
        matchStatus: "needs_review",
        matchConfidence: "medium",
        matchReason: `Name + college (${first} ${last} @ ${hint.uwcCollege})`,
        otherCandidateIds: [],
      };
    }
    if (rows.length > 1) {
      return {
        alumniId: rows[0].id,
        matchStatus: "needs_review",
        matchConfidence: "low",
        matchReason: `${rows.length} candidates with name + college match`,
        otherCandidateIds: rows.slice(1).map((r) => r.id),
      };
    }
  }

  // Tier 4: name only.
  if (first && last) {
    const rows = (await sql`
      SELECT id FROM alumni
      WHERE deceased IS NOT TRUE
        AND lower(first_name) LIKE ${firstLike}
        AND lower(last_name) LIKE ${lastLike}
      LIMIT 10
    `) as { id: number }[];
    if (rows.length === 1) {
      return {
        alumniId: rows[0].id,
        matchStatus: "needs_review",
        matchConfidence: "medium",
        matchReason: `Single name match (${first} ${last})`,
        otherCandidateIds: [],
      };
    }
    if (rows.length > 1) {
      return {
        alumniId: null,
        matchStatus: "needs_review",
        matchConfidence: "low",
        matchReason: `${rows.length} possible name matches`,
        otherCandidateIds: rows.map((r) => r.id),
      };
    }
  }

  return noMatch("No matches found");
}

function noMatch(reason: string): MatchResult {
  return {
    alumniId: null,
    matchStatus: "unmatched",
    matchConfidence: null,
    matchReason: reason,
    otherCandidateIds: [],
  };
}

/**
 * Split a full name into first + last. Naive for v1: first word is first
 * name, last word is last name, everything in between is ignored. Breaks
 * on compound last names like "de la Cruz" — acceptable until it bites.
 */
function parseName(full: string | null): { first: string; last: string } {
  if (!full) return { first: "", last: "" };
  const parts = full
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts[parts.length - 1] };
}
