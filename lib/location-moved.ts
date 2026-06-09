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

// Covers the 9-county SF Bay Area (Alameda, Contra Costa, Marin, San
// Mateo, San Francisco, Santa Clara, Solano, Sonoma, Napa) plus Santa
// Cruz which is socially/commute-wise contiguous. List is intentionally
// long — the cost of an extra entry is zero, the cost of a missing
// entry is a false "moved" badge on someone still local.
const BAY_AREA_PLACES = [
  // Catch-alls
  "bay area",
  "sf bay",
  "northern california",
  // San Francisco
  "san francisco",
  // Alameda County (East Bay)
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
  "san leandro",
  "union city",
  "castro valley",
  "san lorenzo",
  "ashland",
  "cherryland",
  "sunol",
  // Alameda — Tri-Valley
  "pleasanton",
  "livermore",
  "dublin",
  // Contra Costa County (further East Bay)
  "richmond",
  "concord",
  "walnut creek",
  "lafayette",
  "orinda",
  "moraga",
  "pleasant hill",
  "martinez",
  "antioch",
  "pittsburg",
  "bay point",
  "brentwood",
  "oakley",
  "san ramon",
  "danville",
  "alamo",
  "blackhawk",
  "hercules",
  "pinole",
  "rodeo",
  "crockett",
  "el sobrante",
  "kensington",
  "clayton",
  // Santa Clara County (South Bay)
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
  "morgan hill",
  "monte sereno",
  "los altos",
  // San Mateo County (Peninsula)
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
  "stanford",
  "atherton",
  "portola valley",
  "woodside",
  "half moon bay",
  "san carlos",
  "belmont",
  "foster city",
  "hillsborough",
  "brisbane",
  "colma",
  "el granada",
  "moss beach",
  "montara",
  // Marin County (North Bay)
  "marin",
  "novato",
  "san rafael",
  "tiburon",
  "sausalito",
  "mill valley",
  "corte madera",
  "larkspur",
  "fairfax",
  "san anselmo",
  "ross",
  "kentfield",
  "belvedere",
  // Sonoma County
  "petaluma",
  "santa rosa",
  "rohnert park",
  "sebastopol",
  "healdsburg",
  "windsor",
  "cotati",
  "sonoma",
  // Napa County
  "napa",
  "american canyon",
  "yountville",
  "st. helena",
  "saint helena",
  "calistoga",
  // Solano County
  "vallejo",
  "benicia",
  "fairfield",
  "vacaville",
  "suisun city",
  "dixon",
  "rio vista",
  // Santa Cruz County
  "santa cruz",
  "capitola",
  "scotts valley",
  "watsonville",
  "aptos",
  "soquel",
];

import { normalizeCity } from "./city-normalize";

/** Strings that are too vague (or non-locations) to count as a real
 * "new location". Normalized lower-case form — VAGUE_LOCATIONS is
 * checked after normalizeCity() strips trailing state/country
 * qualifiers, so "California, United States" hits via "california". */
const VAGUE_LOCATIONS = new Set([
  // Work-style descriptors that show up in LinkedIn jobLocation
  "hybrid",
  "remote",
  "on-site",
  "on site",
  "onsite",
  "in-office",
  "in office",
  "in-person",
  "in person",
  "office",
  "travel",
  "travelling",
  "traveling",
  "various",
  "multiple locations",
  "anywhere",
  "worldwide",
  "global",
  "international",
  "earth",
  // Country-only (after normalization strips qualifiers)
  "united states",
  "usa",
  "us",
  "u.s.",
  "u.s.a.",
  "united kingdom",
  "uk",
  "u.k.",
  "england",
  "scotland",
  "wales",
  "canada",
  "australia",
  "india",
  "china",
  "germany",
  "france",
  "spain",
  "italy",
  "netherlands",
  "switzerland",
  "sweden",
  "norway",
  "denmark",
  "ireland",
  "north america",
  "americas",
  "europe",
  "asia",
  "africa",
  "south america",
  // US states alone — too coarse to render as "new location"
  "california",
  "ca",
  "texas",
  "tx",
  "florida",
  "fl",
  "new york state",
  "washington",
  "washington state",
  "oregon",
  "colorado",
  "illinois",
  "georgia",
  "michigan",
  "ohio",
  "pennsylvania",
  "virginia",
  "north carolina",
  "south carolina",
  "arizona",
  "nevada",
  "massachusetts",
  "maryland",
  "minnesota",
  "wisconsin",
  "indiana",
  "missouri",
  "tennessee",
  "alabama",
  "louisiana",
  "kentucky",
  "iowa",
  "connecticut",
  "utah",
  "oklahoma",
  "kansas",
  "arkansas",
  "nebraska",
  "idaho",
  "hawaii",
  "new mexico",
  "west virginia",
  "new hampshire",
  "maine",
  "rhode island",
  "vermont",
  "delaware",
  "south dakota",
  "north dakota",
  "montana",
  "wyoming",
  "alaska",
  "new jersey",
]);

function isVague(s: string): boolean {
  const norm = normalizeCity(s);
  if (!norm) return true;
  if (norm.key.length < 3) return true;
  return VAGUE_LOCATIONS.has(norm.key);
}

/**
 * Pick the best available LinkedIn-derived location for display in the
 * "where are they now" badge. Priority:
 *   1. current_location (LinkedIn jobLocation) — set when they took
 *      their current job, less likely to be a stale school/hometown
 *   2. location_full (profile-level addressWithCountry) — often the
 *      city LinkedIn shows next to the alum's name; can be stale
 * Both must be non-vague (no "Remote", country-only, etc.) to count.
 */
export function pickCurrentLocation(opts: {
  current_location: string | null | undefined;
  location_full: string | null | undefined;
}): string | null {
  const jobLoc = opts.current_location?.trim();
  if (jobLoc && !isVague(jobLoc)) return jobLoc;
  const profLoc = opts.location_full?.trim();
  if (profLoc && !isVague(profLoc)) return profLoc;
  return null;
}

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
