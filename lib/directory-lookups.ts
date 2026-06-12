/**
 * Server-side lookups for the directory's photo-led card chrome:
 *   - UWC logo URL keyed by college canonical name
 *   - Country flag URL + display name keyed by ISO-2 (lowercase)
 *
 * Both tables are small (< 30 / < 300 rows) and read-mostly, so the
 * pages fetch the full map once per request and pass it down to
 * client cards instead of round-tripping a lookup per card.
 */

import { sql } from "./db";

export type UwcLogoMap = Record<string, string>;
export type FlagMap = Record<string, { name: string; url: string }>;

export async function getUwcLogoMap(): Promise<UwcLogoMap> {
  const rows = (await sql`
    SELECT canonical, logo_url
    FROM uwc_assets
    WHERE logo_url IS NOT NULL
  `) as Array<{ canonical: string; logo_url: string }>;
  const out: UwcLogoMap = {};
  for (const r of rows) out[r.canonical] = r.logo_url;
  return out;
}

export async function getFlagMap(): Promise<FlagMap> {
  const rows = (await sql`
    SELECT iso, name, blob_url
    FROM country_flags
  `) as Array<{ iso: string; name: string; blob_url: string }>;
  const out: FlagMap = {};
  // ISO codes are stored lowercase; callers will key on lowercase too.
  for (const r of rows) out[r.iso] = { name: r.name, url: r.blob_url };
  return out;
}

/** Strip the "UWC " prefix from a canonical college name. "UWC
 * Atlantic College" → "Atlantic College". Used everywhere we show
 * the campus name to the user (the surrounding directory makes
 * "UWC" implicit). */
export function stripUwcPrefix(canonical: string | null | undefined): string {
  if (!canonical) return "";
  return canonical.replace(/^UWC\s+/i, "");
}
