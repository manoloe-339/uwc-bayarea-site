/**
 * Shared tile shape consumed by all three login backdrops. A "tile" is
 * the unit that every backdrop renders — a circle (Living Wall,
 * Constellation) or a square (Mosaic) showing one of:
 *
 *   - 60% alumni headshot  (kind: 'photo')
 *   - 25% UWC school logo  (kind: 'uwc')
 *   - 10% company / non-UWC university logo (kind: 'org')
 *   -  5% origin-country flag emoji (kind: 'flag')
 *
 * Each backdrop samples from a combined, shuffled pool. The pool
 * cycles through whatever's available in each category so all 18
 * UWCs, every known origin flag, and every directory company logo
 * have a chance to appear.
 */

import { COLLEGES } from "@/lib/uwc-colleges";
import { UWC_SCHOOL_VISUALS } from "@/lib/uwc-school-visuals";

export type LoginTile =
  | {
      kind: "photo";
      id: string;
      imgUrl: string;
      initials: string;
      /** Two-color gradient used as the background while the image
       * loads AND as the fallback if it fails. */
      tone: [string, string];
      /** First name only — what the Mosaic flips to. */
      label: string;
    }
  | {
      kind: "uwc";
      id: string;
      /** LinkedIn-served logo URL or null when none is on file. */
      imgUrl: string | null;
      /** Emoji icon from uwc-school-visuals (always present). */
      icon: string;
      /** Short school name ("UWCSEA", "Atlantic"). */
      short: string;
      /** Full canonical name, used as the back-side label. */
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
      emoji: string;
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

/** Tinted gradient background CSS. Used by photo-fallback and org
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

/** Build the full set of UWC tiles — one per college in the canonical
 * list, regardless of whether the DB has a logo for it. Pairs each
 * college with the LinkedIn-served logo when available (lookup is by
 * exact canonical match), and otherwise relies on the icon emoji from
 * uwc-school-visuals as the visual. The college's `short` name is the
 * monogram fallback. */
export function buildUwcTiles(
  dbLogos: Array<{ school: string; logo: string | null }>,
): LoginTile[] {
  const logoByName: Map<string, string> = new Map();
  for (const r of dbLogos) {
    if (r.school && r.logo) logoByName.set(r.school, r.logo);
  }
  const out: LoginTile[] = [];
  for (const c of COLLEGES) {
    const visual = UWC_SCHOOL_VISUALS[c.canonical];
    out.push({
      kind: "uwc",
      id: `uwc-${c.canonical}`,
      imgUrl: logoByName.get(c.canonical) ?? null,
      icon: visual?.icon ?? "🎓",
      short: c.short,
      label: c.canonical,
    });
  }
  return out;
}

export function buildOrgTiles(
  rows: Array<{ name: string; logo: string | null }>,
): LoginTile[] {
  return rows
    .filter((r) => r.name)
    .map((r) => ({
      kind: "org" as const,
      id: `org-${r.name}`,
      imgUrl: r.logo,
      initials: initialsOf(r.name),
      label: r.name,
    }));
}

/* ------------------------------------------------------------------ */
/* Flags                                                               */
/* ------------------------------------------------------------------ */

import { extractCountryCodes } from "@/lib/country-flag";

function flagEmoji(iso2: string): string {
  const A = 127397;
  return String.fromCodePoint(
    ...iso2.toUpperCase().split("").map((c) => A + c.charCodeAt(0)),
  );
}

function regionName(iso2: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

/** Build flag tiles from a list of alumni `origin` strings. Re-uses
 * the directory's extractCountryCodes() so the same set of countries
 * that show as flags on profile cards show here too. */
export function buildFlagTiles(rows: Array<{ origin: string }>): LoginTile[] {
  const seen = new Set<string>();
  const out: LoginTile[] = [];
  for (const r of rows) {
    for (const iso of extractCountryCodes(r.origin, 3)) {
      if (seen.has(iso)) continue;
      seen.add(iso);
      out.push({
        kind: "flag",
        id: `flag-${iso}`,
        emoji: flagEmoji(iso),
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

/** Combine the four pools into one shuffled list at the 60/25/10/5
 * mix. `target` is the desired total tile count; each pool cycles
 * (with shuffling) to fill its quota, so all 18 UWCs / all flags /
 * all company logos appear at least once when the pool exceeds the
 * total. */
export function buildTilePool(opts: {
  target: number;
  photos: LoginTile[];
  uwcs: LoginTile[];
  orgs: LoginTile[];
  flags: LoginTile[];
  seed: number;
}): LoginTile[] {
  const { target, photos, uwcs, orgs, flags, seed } = opts;
  const photoN = Math.round(target * 0.6);
  const uwcN = Math.round(target * 0.25);
  const orgN = Math.round(target * 0.1);
  const flagN = target - photoN - uwcN - orgN;

  const take = (pool: LoginTile[], n: number, salt: number): LoginTile[] => {
    if (pool.length === 0 || n <= 0) return [];
    const shuffled = shuffleSeeded(pool, seed ^ salt);
    const out: LoginTile[] = [];
    for (let i = 0; i < n; i++) out.push(shuffled[i % shuffled.length]);
    return out;
  };

  return shuffleSeeded(
    [
      ...take(photos, photoN, 1),
      ...take(uwcs, uwcN, 2),
      ...take(orgs, orgN, 3),
      ...take(flags, flagN, 4),
    ],
    seed,
  );
}
