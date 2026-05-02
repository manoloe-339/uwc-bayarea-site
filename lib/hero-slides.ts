import { sql } from "./db";
import { getApprovedPhotosOrdered } from "./event-photos/queries";

/** CSS object-position value. Either a named preset (top/center/bottom)
 * or a custom "X% Y%" pair. Stored as raw CSS so it can be passed to
 * the rendered <Image> directly. */
export type HeroFocalPoint = string;

export const HERO_FOCAL_POINT_PRESETS = ["top", "center", "bottom"] as const;
const CUSTOM_FOCAL_RE = /^\s*\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%\s*$/;

export function isHeroFocalPoint(v: string): boolean {
  if ((HERO_FOCAL_POINT_PRESETS as readonly string[]).includes(v)) return true;
  return CUSTOM_FOCAL_RE.test(v);
}

export interface HeroSlideRow {
  id: number;
  event_id: number | null;
  eyebrow: string | null;
  title: string;
  emphasis: string | null;
  byline: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  focal_point: HeroFocalPoint;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  // Joined event fields (for display in admin + auto-fallback derivation).
  event_slug: string | null;
  event_name: string | null;
  event_date: Date | null;
  event_location: string | null;
}

/** Resolved slide ready for the public hero carousel. */
export interface ResolvedHeroSlide {
  eyebrow: string;
  title: string;
  emphasis: string;
  byline: string;
  cta_label: string;
  cta_href: string;
  image_url: string | null;
  focal_point: HeroFocalPoint;
}

/** Format a Date as "Mon DD · YYYY". */
function formatHeroDate(d: Date): string {
  const date = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).replace(/,/, " ·");
}

/** All hero slides for the admin list (enabled and disabled, in sort order). */
export async function listHeroSlidesForAdmin(): Promise<HeroSlideRow[]> {
  return (await sql`
    SELECT
      h.*,
      e.slug AS event_slug,
      e.name AS event_name,
      e.date AS event_date,
      e.location AS event_location
    FROM homepage_hero_slides h
    LEFT JOIN events e ON e.id = h.event_id
    ORDER BY h.sort_order ASC, h.id ASC
  `) as HeroSlideRow[];
}

export async function getHeroSlideById(id: number): Promise<HeroSlideRow | null> {
  const rows = (await sql`
    SELECT
      h.*,
      e.slug AS event_slug,
      e.name AS event_name,
      e.date AS event_date,
      e.location AS event_location
    FROM homepage_hero_slides h
    LEFT JOIN events e ON e.id = h.event_id
    WHERE h.id = ${id}
    LIMIT 1
  `) as HeroSlideRow[];
  return rows[0] ?? null;
}

/** Resolve enabled hero slides into the shape the carousel needs.
 * For each slide, falls back to the linked event's first approved photo
 * when image_url is null. */
export async function getActiveHeroSlides(): Promise<ResolvedHeroSlide[]> {
  const rows = (await sql`
    SELECT
      h.*,
      e.slug AS event_slug,
      e.name AS event_name,
      e.date AS event_date,
      e.location AS event_location
    FROM homepage_hero_slides h
    LEFT JOIN events e ON e.id = h.event_id
    WHERE h.enabled = TRUE
    ORDER BY h.sort_order ASC, h.id ASC
  `) as HeroSlideRow[];

  if (rows.length === 0) {
    // Auto-fallback: derive slides from the most recent past events
    // with photos, so the homepage isn't blank when no slides are
    // curated yet.
    return await deriveSlidesFromRecentEvents(3);
  }

  const resolved: ResolvedHeroSlide[] = [];
  for (const r of rows) {
    let image = r.image_url;
    if (!image && r.event_id) {
      const photos = await getApprovedPhotosOrdered(r.event_id);
      image = photos[0]?.blob_url ?? null;
    }
    resolved.push({
      eyebrow: r.eyebrow ?? (r.event_date ? formatHeroDate(r.event_date) : ""),
      title: r.title,
      emphasis: r.emphasis ?? "",
      byline: r.byline ?? "",
      cta_label: r.cta_label ?? "See more photos →",
      cta_href: r.cta_href ?? (r.event_slug ? `/events/${r.event_slug}/photos` : "/photos"),
      image_url: image,
      focal_point: r.focal_point,
    });
  }
  return resolved;
}

type RecentForHeroRow = {
  id: number;
  slug: string;
  name: string;
  date: Date;
  location: string | null;
};

/** Auto-fallback when no admin-curated slides exist. */
async function deriveSlidesFromRecentEvents(limit: number): Promise<ResolvedHeroSlide[]> {
  const events = (await sql`
    SELECT e.id, e.slug, e.name, e.date, e.location
    FROM events e
    WHERE e.date < CURRENT_DATE
      AND e.slug <> 'archive'
      AND EXISTS (
        SELECT 1 FROM event_photos ep
        WHERE ep.event_id = e.id AND ep.approval_status = 'approved'
      )
    ORDER BY e.date DESC
    LIMIT ${limit}
  `) as RecentForHeroRow[];

  const slides: ResolvedHeroSlide[] = [];
  for (const e of events) {
    const photos = await getApprovedPhotosOrdered(e.id);
    slides.push({
      eyebrow: formatHeroDate(e.date),
      title: "A look back at",
      emphasis: e.name,
      byline: e.location ?? "",
      cta_label: "See more photos →",
      cta_href: `/events/${e.slug}/photos`,
      image_url: photos[0]?.blob_url ?? null,
      focal_point: "center",
    });
  }
  return slides;
}

/** Lightweight event picker source for the admin slide form. */
export async function listEventsForHeroPicker(): Promise<
  Array<{ id: number; slug: string; name: string; date: Date }>
> {
  return (await sql`
    SELECT id, slug, name, date
    FROM events
    WHERE slug <> 'archive'
    ORDER BY date DESC, id DESC
    LIMIT 100
  `) as Array<{ id: number; slug: string; name: string; date: Date }>;
}

export interface HeroSlideInput {
  event_id: number | null;
  eyebrow: string | null;
  title: string;
  emphasis: string | null;
  byline: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  focal_point: HeroFocalPoint;
  sort_order: number;
  enabled: boolean;
}

export async function createHeroSlide(data: HeroSlideInput): Promise<number> {
  const rows = (await sql`
    INSERT INTO homepage_hero_slides (
      event_id, eyebrow, title, emphasis, byline,
      cta_label, cta_href, image_url, focal_point, sort_order, enabled
    ) VALUES (
      ${data.event_id}, ${data.eyebrow}, ${data.title}, ${data.emphasis}, ${data.byline},
      ${data.cta_label}, ${data.cta_href}, ${data.image_url}, ${data.focal_point},
      ${data.sort_order}, ${data.enabled}
    )
    RETURNING id
  `) as { id: number }[];
  return rows[0].id;
}

export async function updateHeroSlide(
  id: number,
  data: HeroSlideInput
): Promise<void> {
  await sql`
    UPDATE homepage_hero_slides SET
      event_id    = ${data.event_id},
      eyebrow     = ${data.eyebrow},
      title       = ${data.title},
      emphasis    = ${data.emphasis},
      byline      = ${data.byline},
      cta_label   = ${data.cta_label},
      cta_href    = ${data.cta_href},
      image_url   = ${data.image_url},
      focal_point = ${data.focal_point},
      sort_order  = ${data.sort_order},
      enabled     = ${data.enabled},
      updated_at  = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteHeroSlide(id: number): Promise<void> {
  await sql`DELETE FROM homepage_hero_slides WHERE id = ${id}`;
}

export async function setHeroSlideEnabled(id: number, enabled: boolean): Promise<void> {
  await sql`
    UPDATE homepage_hero_slides SET enabled = ${enabled}, updated_at = NOW()
    WHERE id = ${id}
  `;
}
