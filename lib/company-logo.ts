/**
 * Logo.dev render-time helper. Returns an ordered list of candidate
 * image URLs the <CompanyLogo> component walks through on <img>
 * onError, finally falling back to an initials block.
 *
 * Sources for the domain, in priority order:
 *   1. `company_website` from the enrichment payload (most reliable).
 *   2. LinkedIn URL:
 *      • `/company/<slug>/`  → try `<slug>.com`
 *      • `/school/<slug>/`   → try `<slug>.edu`, `<slug>.org`, `<slug>.com`
 *        (universities lean .edu, non-profits/UWCs lean .org, vocational
 *        schools lean .com)
 *
 * Lossy by design — slug-derived domains are wrong for compound names
 * (e.g. "the-world-bank-group" vs worldbank.org). Logo.dev returns a
 * generic placeholder for unknowns and the component swaps to the
 * next candidate on 404. The cheapest layer of coverage before Apify
 * scrapes start populating stored URLs directly.
 */

const COMMON_SUBDOMAINS = new Set([
  "www",
  "careers",
  "jobs",
  "about",
  "corporate",
  "investor",
  "investors",
  "media",
  "press",
  "m",
  "mobile",
]);

function stripMarketingSubdomain(host: string): string {
  const parts = host.split(".");
  if (parts.length < 3) return host;
  if (COMMON_SUBDOMAINS.has(parts[0])) {
    return parts.slice(1).join(".");
  }
  return host;
}

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  const raw = website.trim();
  if (!raw) return null;
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    const host = stripMarketingSubdomain(url.hostname.toLowerCase());
    if (!host || !host.includes(".")) return null;
    return host;
  } catch {
    return null;
  }
}

function cleanSlug(rawSlug: string): string | null {
  const slug = decodeURIComponent(rawSlug).toLowerCase().trim();
  if (!slug) return null;
  if (/^\d+$/.test(slug)) return null;
  if (slug.length > 60) return null;
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return slug;
}

function domainsFromLinkedinUrl(
  url: string | null | undefined,
): string[] {
  if (!url) return [];
  const company = url.match(/\/company\/([^/?#]+)/i);
  if (company) {
    const slug = cleanSlug(company[1]);
    return slug ? [`${slug}.com`] : [];
  }
  // Schools: skipped on purpose. LinkedIn school slugs are descriptive
  // ("the-george-washington-university"), not domains, and Logo.dev
  // returns a generic placeholder PNG with HTTP 200 for unknowns —
  // which defeats our onError fallback chain. The render path falls
  // straight to initials when school_logo_url is null; a server-side
  // backfill (see scripts/backfill-school-logos.mjs) resolves real
  // domains via Logo.dev's brand search API and writes them to the DB.
  return [];
}

function buildLogoUrl(domain: string, token: string, size: number): string {
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=${size}&format=png`;
}

/**
 * Ordered candidate URLs the renderer should try, best-first.
 * Empty array means "no Logo.dev attempt is worth making — fall
 * straight to initials".
 */
export function companyLogoCandidates(
  website: string | null | undefined,
  linkedinUrl: string | null | undefined = null,
  size = 64,
): string[] {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_KEY;
  if (!token) return [];
  const domains: string[] = [];
  const fromWebsite = extractDomain(website);
  if (fromWebsite) domains.push(fromWebsite);
  for (const d of domainsFromLinkedinUrl(linkedinUrl)) {
    if (!domains.includes(d)) domains.push(d);
  }
  return domains.map((d) => buildLogoUrl(d, token, size));
}

/** Backwards-compatible single-URL form. Returns the highest-priority
 * candidate or null. Prefer companyLogoCandidates() when the caller
 * can use a multi-step fallback. */
export function companyLogoUrl(
  website: string | null | undefined,
  linkedinUrl: string | null | undefined = null,
  size = 64,
): string | null {
  const all = companyLogoCandidates(website, linkedinUrl, size);
  return all[0] ?? null;
}
