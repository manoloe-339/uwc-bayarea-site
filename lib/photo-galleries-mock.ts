/**
 * Placeholder galleries used when the database has no events with approved
 * photos yet (i.e. before the backfill). The `/photos` page falls back to
 * these so the layout can be previewed end-to-end. Once any real gallery
 * exists, the real data takes over and this file becomes safe to delete.
 */

import type { GalleryRow, MarqueePhoto } from "./photo-galleries";

const PICSUM = (seed: number, w: number, h: number) =>
  `https://picsum.photos/seed/uwc-${seed}/${w}/${h}`;

type Mock = {
  slug: string;
  title: string;
  date: string; // ISO date
  location: string;
  photoCount: number;
  seeds: number[];
};

const MOCKS: Mock[] = [
  {
    slug: "may-2026-eswatini",
    title: "The fascinating history of eSwatini",
    date: "2026-05-01",
    location: "San Francisco · Mission",
    photoCount: 84,
    seeds: [101, 102, 103, 104, 105, 106, 107],
  },
  {
    slug: "feb-2026-foodies",
    title: "Foodies at Burma Superstar",
    date: "2026-02-14",
    location: "Oakland",
    photoCount: 41,
    seeds: [201, 202, 203, 204, 205, 206],
  },
  {
    slug: "nov-2025-fireside",
    title: "Fireside with Gil Yaron",
    date: "2025-11-08",
    location: "San Francisco · Pacific Heights",
    photoCount: 56,
    seeds: [301, 302, 303, 304, 305, 306, 307],
  },
  {
    slug: "sep-2025-picnic",
    title: "Annual picnic at Crissy Field",
    date: "2025-09-21",
    location: "San Francisco · Presidio",
    photoCount: 132,
    seeds: [401, 402, 403, 404, 405, 406, 407, 408],
  },
  {
    slug: "jun-2025-wedding",
    title: "Maria & Tomas, married in Sausalito",
    date: "2025-06-14",
    location: "Sausalito · Cavallo Point",
    photoCount: 198,
    seeds: [501, 502, 503, 504, 505, 506, 507],
  },
  {
    slug: "mar-2025-mixer",
    title: "Spring mixer at the Battery",
    date: "2025-03-02",
    location: "San Francisco · Jackson Square",
    photoCount: 67,
    seeds: [601, 602, 603, 604, 605],
  },
  {
    slug: "oct-2024-fireside",
    title: "Fireside with Faith Mwaniki",
    date: "2024-10-12",
    location: "Berkeley",
    photoCount: 44,
    seeds: [701, 702, 703, 704, 705, 706],
  },
  {
    slug: "may-2024-50th",
    title: "50th anniversary celebration",
    date: "2024-05-25",
    location: "San Francisco · Fort Mason",
    photoCount: 312,
    seeds: [801, 802, 803, 804, 805, 806, 807, 808, 809],
  },
];

const MARQUEE_SEEDS = [
  104, 502, 405, 301, 805, 203, 408, 503, 102, 706,
  402, 304, 605, 808, 105, 504, 702, 107, 201, 803,
];

export function getMockGalleryRows(thumbsPerRow: number): GalleryRow[] {
  return MOCKS.map((m, idx) => ({
    eventId: -1 - idx, // negative ids so they never collide with real rows
    slug: m.slug,
    title: m.title,
    date: new Date(m.date),
    location: m.location,
    photoCount: m.photoCount,
    thumbs: m.seeds.slice(0, thumbsPerRow).map((seed) => ({
      id: seed,
      url: PICSUM(seed, 800, 600),
      alt: m.title,
      width: 800,
      height: 600,
    })),
  }));
}

export function getMockMarqueePool(): MarqueePhoto[] {
  return MARQUEE_SEEDS.map((seed) => ({
    id: seed,
    url: PICSUM(seed, 800, 600),
    alt: "",
    width: 800,
    height: 600,
  }));
}
