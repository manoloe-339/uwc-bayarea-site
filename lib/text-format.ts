/**
 * Display-time text normalizers. Don't modify DB values — just clean
 * up casing when rendering.
 */

/** Capitalize the first letter of each word in a name or city
 * without touching already-cased letters. So "manolo espinosa" →
 * "Manolo Espinosa", "santa cruz" → "Santa Cruz", but "McDonald"
 * stays "McDonald" and "van der Berg" stays "van Der Berg" (good
 * enough for the messy data we have). */
export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Combine + title-case first and last name into a display string.
 * Falls back to "(no name)" when both are empty. */
export function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const f = titleCase(firstName);
  const l = titleCase(lastName);
  const out = [f, l].filter(Boolean).join(" ");
  return out || "(no name)";
}
