/**
 * Normalize a LinkedIn URL value (as stored on alumni rows) into an
 * absolute href safe to drop into an `<a href>`. Many rows store the
 * URL without protocol (e.g. "linkedin.com/in/kuzhdin"), and browsers
 * treat protocol-less hrefs as relative paths — clicking such a link
 * would resolve to "/admin/alumni/linkedin.com/in/kuzhdin" instead of
 * the actual LinkedIn profile.
 *
 * Returns:
 *   - undefined when the value is null/empty (so callers can omit
 *     `href` entirely instead of rendering a broken link)
 *   - the value unchanged when it already starts with http(s)://
 *   - the value prefixed with "https://" otherwise
 *
 * Intentionally NOT canonicalizing further (slug case, www, etc.) —
 * the canonicalization lives in lib/discovery/queries.ts and is used
 * for dedup. This helper is purely "make it clickable."
 */
export function linkedinHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}
