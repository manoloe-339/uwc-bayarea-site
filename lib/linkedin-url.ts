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

/**
 * Permissive write-time normalizer for LinkedIn profile URLs. Takes
 * whatever the user typed and produces a clean canonical URL ready
 * for storage, or null when the input cannot plausibly be a profile.
 *
 * Handles these inputs (all → "https://www.linkedin.com/in/manoloe"):
 *   - "manoloe"                                  (bare slug)
 *   - "/manoloe"                                 (slash + slug)
 *   - "in/manoloe" or "/in/manoloe"              (path fragment)
 *   - "linkedin.com/in/manoloe"                  (no protocol)
 *   - "www.linkedin.com/in/manoloe"
 *   - "https://uk.linkedin.com/in/manoloe/"      (regional + trailing)
 *   - "https://www.linkedin.com/in/manoloe?utm=…" (query/fragment dropped)
 *
 * Returns null for inputs that don't resolve to a /in/<slug> profile
 * URL (e.g. company pages, post URLs, garbage). Caller decides what
 * to do with null — typically: store null and surface a validation
 * error to the user.
 *
 * Distinct from `normalizeLinkedinUrl` in lib/discovery/queries.ts
 * which is stricter (rejects bare slugs) because it runs at dedup
 * time on already-canonical URLs from web scrapes.
 */
export function normalizeLinkedinForStorage(
  input: string | FormDataEntryValue | null | undefined,
): string | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;

  // Strip protocol so we can normalize uniformly.
  s = s.replace(/^https?:\/\//i, "");
  // Collapse www. and regional subdomains (uk.linkedin.com, de.linkedin.com…).
  s = s.replace(/^(www\.|[a-z]{2,3}\.)?linkedin\.com\//i, "linkedin.com/");

  // If we still don't have a linkedin.com host, treat the rest as a
  // path fragment: strip leading slashes and a leading "in/" so we
  // don't end up with "/in/in/manoloe", then prepend the canonical
  // /in/ path.
  if (!/^linkedin\.com\//i.test(s)) {
    s = s.replace(/^\/+/, "");
    s = s.replace(/^in\/+/i, "");
    s = `linkedin.com/in/${s}`;
  }

  // Drop query string, fragment, and any trailing slashes.
  s = s.split(/[?#]/)[0].replace(/\/+$/, "");

  // Validate: must match linkedin.com/in/<slug>. The slug may contain
  // letters, digits, hyphens, and percent-encoded sequences (LinkedIn
  // sometimes urlencodes non-ASCII characters). Reject anything else
  // (company pages, posts, search results, etc.).
  const match = s.match(/^linkedin\.com\/in\/([A-Za-z0-9._%-]+)$/i);
  if (!match) return null;

  return `https://www.linkedin.com/in/${match[1].toLowerCase()}`;
}
