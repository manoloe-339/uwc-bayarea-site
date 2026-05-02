/** Client-safe Foodies constants. Lives separately from lib/events-db.ts
 * so client components in the admin event form can import without
 * pulling the Neon SQL client into the browser bundle. */

export const FOODIES_REGIONS = [
  "San Francisco",
  "East Bay",
  "Peninsula",
  "North Bay",
] as const;

export type FoodiesRegion = (typeof FOODIES_REGIONS)[number];

export function isFoodiesRegion(v: string): v is FoodiesRegion {
  return (FOODIES_REGIONS as readonly string[]).includes(v);
}
