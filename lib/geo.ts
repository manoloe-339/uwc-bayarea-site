/**
 * Coarse geolocation derived from Vercel's x-vercel-ip-* request
 * headers. Same shape we already store on the marketing-site
 * `visits` table — country + region + city + user-agent, no raw IP.
 *
 * Works for any caller that can supply a Headers-like object: a
 * Next.js Route Handler (`req.headers`), a Server Component
 * (`await headers()` from `next/headers`), or a Middleware request.
 */

export type GeoFields = {
  country: string | null;
  region: string | null;
  city: string | null;
  userAgent: string | null;
};

/** Minimal duck-typed Headers reader so this helper takes both
 *  `Headers` (Web Fetch API) and Next's `ReadonlyHeaders`. */
type HeaderReader = { get(name: string): string | null };

export function readGeoFields(h: HeaderReader): GeoFields {
  const country = h.get("x-vercel-ip-country");
  const region = h.get("x-vercel-ip-country-region");
  const cityRaw = h.get("x-vercel-ip-city");
  const userAgent = h.get("user-agent");
  return {
    country: country || null,
    region: region || null,
    // Vercel URL-encodes city names that contain spaces / accents.
    city: cityRaw ? decodeURIComponent(cityRaw) : null,
    userAgent: userAgent || null,
  };
}

/** All-nulls fallback for code paths that genuinely don't have a
 *  request in hand (server jobs, cron, etc). */
export const NULL_GEO: GeoFields = {
  country: null,
  region: null,
  city: null,
  userAgent: null,
};
