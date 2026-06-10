/**
 * Shared tile shape consumed by all three login backdrops. A "tile" is
 * the unit that every backdrop renders — a circle (Living Wall,
 * Constellation) or a square (Mosaic) showing one of:
 *
 *   - 60% alumni headshot  (kind: 'photo')
 *   - 25% UWC school logo  (kind: 'uwc')
 *   - 10% company / non-UWC university logo (kind: 'org')
 *   -  5% origin-country flag SVG (kind: 'flag')
 *
 * Each backdrop samples from one combined, shuffled pool.
 */

import { extractCountryCodes } from "@/lib/country-flag";

export type LoginTile =
  | {
      kind: "photo";
      id: string;
      imgUrl: string;
      /** Two-color background gradient — shown while the image loads
       * and as the fallback if it fails. */
      tone: [string, string];
      initials: string;
      /** First name only, used as the title attribute. */
      label: string;
    }
  | {
      kind: "uwc";
      id: string;
      /** Logo URL — these are all self-hosted on Vercel Blob after
       * the backfill, so we always have one (no fallback needed). */
      imgUrl: string;
      /** School name as stored in alumni_education ("UWC Atlantic
       * College", "Li Po Chun United World College of Hong Kong",
       * etc.). Used as the tooltip. */
      label: string;
    }
  | {
      kind: "org";
      id: string;
      imgUrl: string | null;
      initials: string;
      label: string;
    }
  | {
      kind: "flag";
      id: string;
      /** Curated flag image URL (Vercel Blob). Used for both round
       * (Constellation, Living Wall) and square (Mosaic) tiles —
       * the admin uploads whichever shape looks best, and we cover-
       * crop to the tile. */
      imgUrl: string;
      label: string;
    };

const PHOTO_TONES: Array<[string, string]> = [
  ["#e7d3bf", "#c49b78"],
  ["#cdd6dd", "#92a6b4"],
  ["#d8d1ba", "#a69d79"],
  ["#e4c8be", "#bd8b7d"],
  ["#c5d2cd", "#8da7a0"],
  ["#d3cada", "#9c8db0"],
  ["#ccd9e1", "#88a5b8"],
  ["#ddd2c3", "#b29d84"],
  ["#e0cdc6", "#b8867f"],
  ["#cfd8c9", "#97a684"],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Tinted gradient background — used by photo-fallback and org
 * monogram tiles. */
export function tileBackground([a, b]: [string, string]): string {
  return (
    `radial-gradient(118% 118% at 30% 22%, rgba(255,255,255,.62), rgba(255,255,255,0) 44%),` +
    `linear-gradient(180deg, rgba(11,37,69,0) 52%, rgba(11,37,69,.20) 100%),` +
    `linear-gradient(155deg, ${a}, ${b})`
  );
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

export function buildPhotoTiles(
  rows: Array<{
    id: number;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
  }>,
): LoginTile[] {
  const out: LoginTile[] = [];
  for (const r of rows) {
    if (!r.photo_url || !r.first_name) continue;
    const first = r.first_name.trim();
    const h = hash(first + (r.last_name ?? ""));
    out.push({
      kind: "photo",
      id: `photo-${r.id}`,
      imgUrl: r.photo_url,
      initials: initialsOf(`${first} ${r.last_name ?? ""}`),
      tone: PHOTO_TONES[h % PHOTO_TONES.length],
      label: first,
    });
  }
  return out;
}

/** Build UWC tiles from the curated uwc_assets table — admin-managed
 * via /admin/tools/uwc-assets. Only emits a tile for UWCs that have
 * a logo on file. */
export function buildUwcTiles(
  rows: Array<{ canonical: string; logo_url: string | null }>,
): LoginTile[] {
  const seen = new Set<string>();
  const out: LoginTile[] = [];
  for (const r of rows) {
    if (!r.logo_url || seen.has(r.canonical)) continue;
    seen.add(r.canonical);
    out.push({
      kind: "uwc",
      id: `uwc-${r.canonical}`,
      imgUrl: r.logo_url,
      label: r.canonical,
    });
  }
  return out;
}

/** Build photo tiles from UWC campus / other slots — these go into
 * the photo pool alongside alumni headshots and feed Living Wall,
 * Constellation, and Mosaic photo slots. */
export function buildUwcPhotoTiles(
  rows: Array<{
    canonical: string;
    campus_url: string | null;
    other_url: string | null;
  }>,
): LoginTile[] {
  const out: LoginTile[] = [];
  for (const r of rows) {
    if (r.campus_url) {
      out.push({
        kind: "photo",
        id: `uwc-campus-${r.canonical}`,
        imgUrl: r.campus_url,
        initials: r.canonical.replace(/^UWC\s+/, "").slice(0, 2).toUpperCase(),
        tone: PHOTO_TONES[hash(r.canonical) % PHOTO_TONES.length],
        label: r.canonical,
      });
    }
    if (r.other_url) {
      out.push({
        kind: "photo",
        id: `uwc-other-${r.canonical}`,
        imgUrl: r.other_url,
        initials: r.canonical.replace(/^UWC\s+/, "").slice(0, 2).toUpperCase(),
        tone: PHOTO_TONES[hash(r.canonical + "x") % PHOTO_TONES.length],
        label: r.canonical,
      });
    }
  }
  return out;
}

/** Build org-logo tiles from curated login_assets rows (kind =
 * university_logo OR company_logo). Both kinds render the same way
 * in the backdrop — the dropdown is a curation hint for the admin. */
export function buildOrgTiles(
  rows: Array<{ id: number; label: string; image_url: string }>,
): LoginTile[] {
  const seen = new Set<string>();
  const out: LoginTile[] = [];
  for (const r of rows) {
    if (!r.image_url || seen.has(r.image_url)) continue;
    seen.add(r.image_url);
    out.push({
      kind: "org",
      id: `org-${r.id}`,
      imgUrl: r.image_url,
      initials: initialsOf(r.label),
      label: r.label,
    });
  }
  return out;
}

/** Build flag tiles from curated login_assets rows (kind = flag).
 * The admin uploads whichever flag image looks best for each
 * country — no vendored SVG fallback. If the library has no flag
 * entries, no flag tiles appear in the login backdrop. */
export function buildFlagTiles(
  rows: Array<{ id: number; label: string; image_url: string }>,
): LoginTile[] {
  const seen = new Set<string>();
  const out: LoginTile[] = [];
  for (const r of rows) {
    if (!r.image_url || seen.has(r.image_url)) continue;
    seen.add(r.image_url);
    out.push({
      kind: "flag",
      id: `flag-${r.id}`,
      imgUrl: r.image_url,
      label: r.label,
    });
  }
  return out;
}

// Re-export so external callers can stop importing it from here once
// we've fully migrated. extractCountryCodes is still used by the
// directory profile pages (country flag emoji next to alum names).
export { extractCountryCodes };

/* ------------------------------------------------------------------ */
/* Pool builder                                                        */
/* ------------------------------------------------------------------ */

function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Combine the four pools at the 60 / 25 / 10 / 5 mix and return them
 * in a STRIDE-DISTRIBUTED order (not a random shuffle), so when the
 * Mosaic walks pool[0..N] it never clusters two same-category tiles
 * adjacent to each other.
 *
 * Each tile gets a "target position" along [0, target):
 *   - photos at i * (target / photoCount)
 *   - UWCs   at (i + 0.4) * (target / uwcCount)
 *   - orgs   at (i + 0.7) * (target / orgCount)
 *   - flags  at (i + 0.2) * (target / flagCount)
 * The fractional offsets keep categories from landing on the same
 * slot when their strides happen to align. We then sort by target
 * position to get a deterministic, well-spread ordering.
 *
 * No duplicates by id are emitted. Categories cap at their available
 * supply (e.g. ~18 unique UWCs); shortfalls are filled with extra
 * photos (we always have plenty).
 */
export function buildTilePool(opts: {
  target: number;
  photos: LoginTile[];
  uwcs: LoginTile[];
  orgs: LoginTile[];
  flags: LoginTile[];
  seed: number;
}): LoginTile[] {
  const { target, photos, uwcs, orgs, flags, seed } = opts;
  const wantPhoto = Math.round(target * 0.6);
  const wantUwc = Math.round(target * 0.25);
  const wantOrg = Math.round(target * 0.1);
  const wantFlag = target - wantPhoto - wantUwc - wantOrg;

  const take = (pool: LoginTile[], n: number, salt: number): LoginTile[] => {
    if (pool.length === 0 || n <= 0) return [];
    const shuffled = shuffleSeeded(pool, seed ^ salt);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  };

  const pickedUwcs = take(uwcs, wantUwc, 2);
  const pickedOrgs = take(orgs, wantOrg, 3);
  const pickedFlags = take(flags, wantFlag, 4);
  const pickedPhotos = take(photos, wantPhoto, 1);

  // Top up photos to fill any shortfall from logo/flag categories.
  const totalSoFar =
    pickedUwcs.length + pickedOrgs.length + pickedFlags.length + pickedPhotos.length;
  const shortfall = target - totalSoFar;
  const usedPhotoIds = new Set(pickedPhotos.map((p) => p.id));
  const photoExtras =
    shortfall > 0
      ? shuffleSeeded(photos, seed ^ 5)
          .filter((p) => !usedPhotoIds.has(p.id))
          .slice(0, shortfall)
      : [];
  const allPhotos = [...pickedPhotos, ...photoExtras];

  // Slot-based jitter. Each category divides the pool into N equal
  // slots (one per item), and each item lands at a RANDOM position
  // WITHIN its slot. This guarantees:
  //   - each item gets a unique region (no clumping into one third)
  //   - adjacent positions are random, not fixed-stride — so when
  //     the 1-D pool gets mapped to a 2-D Mosaic grid, the items
  //     don't cycle through the same N columns over and over
  //
  // A fixed stride (target / N) modulo grid_columns produced
  // exactly-3-columns-of-UWCs on a 10-column grid (Manolo's "cluster
  // on left, nothing on right" report). Slot-jitter breaks that
  // cycle.
  const rand01 = (s: number) => ((s >>> 0) % 1_000_003) / 1_000_003;

  type Placed = { pos: number; tile: LoginTile };
  const placed: Placed[] = [];
  const place = (pool: LoginTile[], salt: number) => {
    if (pool.length === 0) return;
    const slotSize = target / pool.length;
    // Global per-category offset: rotates ALL items in the category
    // by the same amount each visit. Without this, slot boundaries
    // were fixed across visits (UWC slot 0 was always [0, slotSize),
    // etc.), so UWCs landed in the same cells every load. The
    // offset shifts the entire category to a fresh starting
    // position per request.
    const globalOffset = rand01((seed ^ salt) >>> 0 ^ 0xbeef) * target;
    // Jitter is clamped to the MIDDLE 50% of each slot (0.25 →
    // 0.75 of slot). That guarantees adjacent items in the same
    // category are at least slotSize × 0.5 apart in the pool —
    // for UWCs (slotSize ≈ 13.3) that's a minimum 6.7-cell gap,
    // enough to avoid orthogonal adjacency on any grid ≥ 8
    // columns. Mobile grids (4-6 columns) may still produce
    // occasional diagonal neighbors; addressing that would
    // require client-side 2-D placement.
    for (let i = 0; i < pool.length; i++) {
      const jitter =
        (0.25 + rand01(seed ^ salt ^ (i * 2654435761)) * 0.5) * slotSize;
      placed.push({
        pos: (globalOffset + i * slotSize + jitter) % target,
        tile: pool[i],
      });
    }
  };
  place(allPhotos, 11);
  place(pickedUwcs, 22);
  place(pickedOrgs, 33);
  place(pickedFlags, 44);

  placed.sort((a, b) => a.pos - b.pos);
  return placed.map((p) => p.tile);
}
