/**
 * Detect when an alum's LinkedIn-reported location has them living
 * OUTSIDE the SF Bay Area. The Bay Area is defined as the named cities
 * and counties listed below — anyone with at least one of those tokens
 * in their LinkedIn location_full is considered "still local",
 * regardless of where they registered.
 *
 * Used purely for display ("🧳 Seattle, Washington" badge). Returns
 * null when:
 *   - We don't have a LinkedIn location to compare against
 *   - The LinkedIn location is still inside the Bay Area
 *   - The LinkedIn location is too vague to tell ("United States",
 *     "California", etc.)
 */

const BAY_AREA_PLACES = [
  // Top-level
  "bay area",
  // San Francisco
  "san francisco",
  // East Bay
  "oakland",
  "berkeley",
  "alameda",
  "albany",
  "el cerrito",
  "emeryville",
  "fremont",
  "hayward",
  "newark",
  "piedmont",
  "richmond",
  "san leandro",
  "union city",
  // South Bay
  "san jose",
  "sunnyvale",
  "mountain view",
  "santa clara",
  "milpitas",
  "los gatos",
  "campbell",
  "saratoga",
  "cupertino",
  "gilroy",
  // Peninsula
  "palo alto",
  "menlo park",
  "redwood city",
  "san mateo",
  "burlingame",
  "millbrae",
  "san bruno",
  "south san francisco",
  "daly city",
  "pacifica",
  "los altos",
  "stanford",
  "atherton",
  "portola valley",
  "woodside",
  "half moon bay",
  // North Bay
  "marin",
  "novato",
  "san rafael",
  "tiburon",
  "sausalito",
  "mill valley",
  "corte madera",
  "larkspur",
  "petaluma",
  "santa rosa",
  "napa",
  "vallejo",
  // Santa Cruz fringe — close enough socially / commute-wise
  "santa cruz",
];

/** Strings that are too vague to count as a real "new location". */
const VAGUE_LOCATIONS = new Set([
  "united states",
  "usa",
  "us",
  "u.s.",
  "u.s.a.",
  "california",
  "ca",
  "north america",
  "americas",
  "earth",
  "remote",
  "worldwide",
]);

/**
 * Returns the new location string for display when the alum has
 * apparently moved out of the Bay Area, or null otherwise.
 *
 * Inputs:
 *   locationFull — alumni.location_full (LinkedIn `addressWithCountry`)
 */
export function detectMovedFromBayArea(
  locationFull: string | null | undefined,
): string | null {
  if (!locationFull) return null;
  const raw = locationFull.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  // Still in Bay → no badge.
  if (BAY_AREA_PLACES.some((place) => lower.includes(place))) {
    return null;
  }

  // Too vague to claim a "new location" — skip the badge.
  if (VAGUE_LOCATIONS.has(lower)) return null;
  if (lower.length < 3) return null;

  return raw;
}
