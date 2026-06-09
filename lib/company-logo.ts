/**
 * Logo.dev render-time helper. We pass a publishable key (safe to inline
 * client-side) and Logo.dev's CDN returns a transparent PNG of the
 * company logo when one is known. Returns null when we don't have
 * enough information to build a request — callers should fall back to
 * an initials block in that case.
 *
 * Sources for the domain, in priority order:
 *   1. `company_website` populated from the LinkedIn enrichment
 *      payload (most reliable when present)
 *   2. nothing — the LinkedIn slug is NOT a domain (e.g. the company
 *      slug "the-world-bank-group" has no relation to "worldbank.org")
 */

function extractDomain(website: string | null): string | null {
  if (!website) return null;
  const raw = website.trim();
  if (!raw) return null;
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    // Reject obvious junk (no dot → not a domain)
    if (!host || !host.includes(".")) return null;
    return host;
  } catch {
    return null;
  }
}

export function companyLogoUrl(website: string | null, size = 64): string | null {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_KEY;
  if (!token) return null;
  const domain = extractDomain(website);
  if (!domain) return null;
  // Logo.dev: https://docs.logo.dev/  — token required, size hint
  // accepted, format=png keeps transparent background.
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=${size}&format=png`;
}
