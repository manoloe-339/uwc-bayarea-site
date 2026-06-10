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

/**
 * Canonical list of UWC logos for the login backdrop. Frozen by hand
 * (no DB lookup) so name-variant noise in alumni_education
 * ("UWC USA" vs "UWC-USA" vs "UWC USA Armand Hammer United World
 * College of the American West") can never duplicate a tile. Each
 * URL is the Vercel-Blob asset we backfilled from LinkedIn.
 *
 * 18 entries — all currently-operating UWCs. (UWC Simón Bolívar
 * closed in 2012; no logo on file.) Edit this list — and only this
 * list — if a UWC's official mark changes or we want a different
 * image for one of them.
 */
const UWC_LOGOS: Array<{ name: string; url: string }> = [
  { name: "UWC Atlantic", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/6b3cd189bab61b317c7e6aba.jpg" },
  { name: "UWC Pearson", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/f9a5c7159703e6a3068a5999.jpg" },
  { name: "UWC USA", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/db9ec0624929ebc519c29e04.jpg" },
  { name: "UWC Adriatic", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/6dafe4f483023b19277a7c5e.jpg" },
  { name: "UWC Red Cross Nordic", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/b56648ffabea7d1d0446dd2a.jpg" },
  { name: "UWC Mahindra", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/a75ec6c3fca5080bb1b8b4fa.jpg" },
  { name: "UWC Costa Rica", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/445b0c0de0340c671e7dd26b.jpg" },
  { name: "UWC Waterford Kamhlaba", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/87ab45f3da11473dc8febf48.jpg" },
  { name: "UWC Mostar", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/9338f94c5b8c99da0087622a.jpg" },
  { name: "UWC Li Po Chun", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/00995ff3317fbad58dd78fd2.jpg" },
  { name: "UWC Robert Bosch College", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/f4bced753e49ea2af9cea165.jpg" },
  { name: "UWC Dilijan", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/ac8df365daaa8aa7d801b695.jpg" },
  { name: "UWC Maastricht", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/a504264cd4e735f5438e533e.jpg" },
  { name: "UWC Changshu China", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/9449bd9b4bed3f7d7d897adf.jpg" },
  { name: "UWC Thailand", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/92a260ec58266a951ee427e9.jpg" },
  { name: "UWC ISAK Japan", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/ebcf4f8721a49b331ecefe4e.jpg" },
  { name: "UWC South East Asia", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/1a07b264c0f6b2a17179c71a.jpg" },
  { name: "UWC East Africa", url: "https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/1b3112dbe9fc890e6c9d0632.jpg" },
];

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

/** Build the UWC tile list from the frozen UWC_LOGOS constant — no
 * DB lookup. Exactly one tile per canonical UWC, never duplicates,
 * never affected by alumni-entered name variants. */
export function buildUwcTiles(): LoginTile[] {
  return UWC_LOGOS.map((u) => ({
    kind: "uwc" as const,
    id: `uwc-${u.name}`,
    imgUrl: u.url,
    label: u.name,
  }));
}

export function buildOrgTiles(
  rows: Array<{ name: string; logo: string | null }>,
): LoginTile[] {
  // Dedup by logo URL (defensive — the SQL also dedups).
  const seen = new Set<string>();
  const out: LoginTile[] = [];
  for (const r of rows) {
    if (!r.name || !r.logo) continue;
    if (seen.has(r.logo)) continue;
    seen.add(r.logo);
    out.push({
      kind: "org",
      id: `org-${r.logo}`,
      imgUrl: r.logo,
      initials: initialsOf(r.name),
      label: r.name,
    });
  }
  return out;
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
    for (let i = 0; i < pool.length; i++) {
      const jitter = rand01(seed ^ salt ^ (i * 2654435761)) * slotSize;
      placed.push({
        pos: i * slotSize + jitter,
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
