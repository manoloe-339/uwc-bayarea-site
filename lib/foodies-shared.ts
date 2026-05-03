/** Client-safe Foodies constants. Lives separately from lib/events-db.ts
 * so client components in the admin event form can import without
 * pulling the Neon SQL client into the browser bundle. */

export const FOODIES_REGIONS = [
  "San Francisco",
  "East Bay",
  "Peninsula / South Bay",
  "North Bay",
] as const;

export type FoodiesRegion = (typeof FOODIES_REGIONS)[number];

export const CARD_BACKDROPS = ["none", "region_tint", "cuisine_flag"] as const;
export type CardBackdrop = (typeof CARD_BACKDROPS)[number];

export function isCardBackdrop(v: string): v is CardBackdrop {
  return (CARD_BACKDROPS as readonly string[]).includes(v);
}

/** Per-region accent: very subtle wash + matching top stripe. Renders
 * when card_backdrop = 'region_tint'. */
export const REGION_ACCENTS: Record<string, { wash: string; stripe: string }> = {
  "San Francisco":          { wash: "rgba(56, 144, 220, 0.07)",  stripe: "#3890DC" },
  "East Bay":               { wash: "rgba(228, 124, 67, 0.08)",  stripe: "#E47C43" },
  "Peninsula / South Bay":  { wash: "rgba(98, 158, 92, 0.08)",   stripe: "#629E5C" },
  "North Bay":              { wash: "rgba(149, 113, 184, 0.08)", stripe: "#9571B8" },
};

/** Map legacy region values that may still arrive from cached admin
 * forms after a rename. Keep these aliases pointing at the current
 * canonical label until cached clients are guaranteed to be gone. */
const LEGACY_REGION_ALIASES: Record<string, FoodiesRegion> = {
  Peninsula: "Peninsula / South Bay",
};

export function isFoodiesRegion(v: string): v is FoodiesRegion {
  if ((FOODIES_REGIONS as readonly string[]).includes(v)) return true;
  return v in LEGACY_REGION_ALIASES;
}

/** Resolve a region string (possibly a legacy alias) to its current
 * canonical label. Returns null if not recognised. */
export function normalizeFoodiesRegion(v: string): FoodiesRegion | null {
  const t = v.trim();
  if (!t) return null;
  if ((FOODIES_REGIONS as readonly string[]).includes(t)) return t as FoodiesRegion;
  return LEGACY_REGION_ALIASES[t] ?? null;
}
