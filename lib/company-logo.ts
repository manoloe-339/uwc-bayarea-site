/**
 * Logo.dev render-time helper. We pass a publishable key (safe to inline
 * client-side) and Logo.dev's CDN returns a transparent PNG of the
 * company logo when one is known. Returns null when we don't have
 * enough information to build a request — callers should fall back to
 * an initials block in that case.
 *
 * Sources for the domain, in priority order:
 *   1. `company_website` from the LinkedIn enrichment payload
 *      (most reliable when present)
 *   2. Derived from the LinkedIn company slug (`/company/<slug>/`) by
 *      appending ".com". Lossy but catches major brands: the slug
 *      "linkedin" → linkedin.com, "citi" → citi.com, "stripe" →
 *      stripe.com. Wrong for "the-world-bank-group" (real domain is
 *      worldbank.org), but Logo.dev returns a generic placeholder for
 *      misses and the component swaps to an initials block on 404.
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

/** Strip a leading subdomain when it's a well-known marketing prefix
 * (careers.linkedin.com → linkedin.com). Conservative: only strips one
 * level and only when the prefix is in our allowlist. */
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

/** Derive a candidate domain from a LinkedIn company URL by appending
 * .com to the slug. Wrong for many edge cases (compound brands,
 * non-.com TLDs) but catches major brands cheaply when company_website
 * is missing. Render-time onError fallback handles misses. */
function domainFromLinkedinUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/company\/([^/?#]+)/i);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).toLowerCase().trim();
  if (!slug) return null;
  // Reject slugs that look like internal/synthetic (numbers only,
  // or super long compound names that won't map to a real domain).
  if (/^\d+$/.test(slug)) return null;
  if (slug.length > 40) return null;
  // Keep simple slugs (letters / digits / hyphens) and add .com.
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return `${slug}.com`;
}

export function companyLogoUrl(
  website: string | null | undefined,
  linkedinUrl: string | null | undefined = null,
  size = 64,
): string | null {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_KEY;
  if (!token) return null;
  const domain = extractDomain(website) ?? domainFromLinkedinUrl(linkedinUrl);
  if (!domain) return null;
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=${size}&format=png`;
}
