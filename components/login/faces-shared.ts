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
      /** Path to the self-hosted SVG (under /public/flags). */
      svgUrl: string;
      iso: string;
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

/** Build UWC tiles directly from the alumni_education rows that have
 * is_uwc=true and a logo. Each (school, logo) the LinkedIn scrape
 * stored becomes one tile — no canonical-name mapping needed, since
 * the logo itself is what we're showing. Dedups by school name so a
 * UWC with 60 alumni records only generates one tile. */
export function buildUwcTiles(
  dbLogos: Array<{ school: string; logo: string | null }>,
): LoginTile[] {
  const seen = new Set<string>();
  const out: LoginTile[] = [];
  for (const r of dbLogos) {
    if (!r.school || !r.logo) continue;
    if (seen.has(r.school)) continue;
    seen.add(r.school);
    out.push({
      kind: "uwc",
      id: `uwc-${r.school}`,
      imgUrl: r.logo,
      label: r.school,
    });
  }
  return out;
}

export function buildOrgTiles(
  rows: Array<{ name: string; logo: string | null }>,
): LoginTile[] {
  return rows
    .filter((r) => r.name && r.logo)
    .map((r) => ({
      kind: "org" as const,
      id: `org-${r.name}`,
      imgUrl: r.logo,
      initials: initialsOf(r.name),
      label: r.name,
    }));
}

function regionName(iso2: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

/** Flag tiles. The SVG asset paths point at /public/flags/{iso}.svg,
 * vendored from HatScripts/circle-flags (MIT). Any country we don't
 * have an SVG for is silently dropped — better no flag than a broken
 * link in the backdrop. */
export function buildFlagTiles(rows: Array<{ origin: string }>): LoginTile[] {
  const seen = new Set<string>();
  const out: LoginTile[] = [];
  for (const r of rows) {
    for (const iso of extractCountryCodes(r.origin, 3)) {
      const lower = iso.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push({
        kind: "flag",
        id: `flag-${lower}`,
        svgUrl: `/flags/${lower}.svg`,
        iso: iso.toUpperCase(),
        label: regionName(iso),
      });
    }
  }
  return out;
}

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

  // Per-visit jitter: each category's start offset rotates based on
  // the seed so the same logo doesn't always land in the same cell
  // across loads. Without this the stride distribution is fully
  // deterministic and the Mosaic feels static on refresh.
  const jit = (salt: number) => {
    const s = (seed ^ salt) >>> 0;
    return ((s % 1000) / 1000) % 1; // [0, 1)
  };

  type Placed = { pos: number; tile: LoginTile };
  const placed: Placed[] = [];
  const place = (pool: LoginTile[], salt: number) => {
    if (pool.length === 0) return;
    const stride = target / pool.length;
    const startOffset = jit(salt) * stride; // jitter the phase
    for (let i = 0; i < pool.length; i++) {
      placed.push({
        pos: (startOffset + i * stride) % target,
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
