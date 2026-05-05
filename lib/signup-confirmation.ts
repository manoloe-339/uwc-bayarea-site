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
            AND id <> ${excludeId}
        `) as { n: number }[])
      : ((await sql`
          SELECT COUNT(*)::int AS n FROM alumni
          WHERE uwc_college = ${college}
            AND deceased IS NOT TRUE
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

/** Substitute {college}, {college_count}, {college_blurb} in the
 * confirmation markdown body. Unknown {placeholders} are left as-is. */
export function applyConfirmationPlaceholders(
  md: string,
  ctx: { college: string | null; collegeCount: number },
): string {
  return md
    .replaceAll("{college_blurb}", buildCollegeBlurb(ctx.college, ctx.collegeCount))
    .replaceAll("{college_count}", String(ctx.collegeCount))
    .replaceAll("{college}", ctx.college ?? "");
}
