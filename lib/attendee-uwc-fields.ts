/**
 * Helpers for pulling the freeform UWC info attendees enter at Stripe
 * checkout (custom field). Used to seed name tags when the attendee
 * isn't matched to an alumni record.
 */

/** Pull the raw UWC custom-field value from a Stripe checkout session. */
export function extractUwcField(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const f of raw) {
    if (!f || typeof f !== "object") continue;
    const obj = f as {
      key?: string;
      label?: { custom?: string | null } | null;
      text?: { value?: string | null } | null;
      dropdown?: { value?: string | null } | null;
      numeric?: { value?: string | null } | null;
    };
    const key = (obj.key ?? "").toLowerCase();
    const label = (obj.label?.custom ?? "").toLowerCase();
    if (!key.includes("uwc") && !label.includes("uwc")) continue;
    const value = obj.text?.value ?? obj.dropdown?.value ?? obj.numeric?.value ?? null;
    if (value && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Best-effort parse of strings like:
 *   "USA/2016"
 *   "UWC Mahindra 2002 / UWCIO"
 *   "UWCSEA Class of 2010"
 *   "Atlantic 1995"
 * into a (college, year) pair. Year is only returned if a 4-digit
 * year between 1960 and (currentYear+2) is found. The college is the
 * raw string with the year (and surrounding punctuation/whitespace)
 * stripped out — admin can clean it up further.
 */
export function parseUwcCollegeAndYear(raw: string | null | undefined): {
  college: string | null;
  year: number | null;
} {
  if (!raw) return { college: null, year: null };
  const max = new Date().getFullYear() + 2;
  let year: number | null = null;
  const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const n = Number(yearMatch[1]);
    if (n >= 1960 && n <= max) year = n;
  }
  let college = raw;
  if (year) {
    college = college.replace(/\b(19\d{2}|20\d{2})\b/, "");
  }
  // Tidy whitespace and stray separators left after stripping the year.
  college = college
    .replace(/\bclass of\b/gi, "")
    .replace(/[\s/·,;|·–-]+/g, " ")
    .trim();
  if (!college) college = null as never;
  return { college: college || null, year };
}
