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
