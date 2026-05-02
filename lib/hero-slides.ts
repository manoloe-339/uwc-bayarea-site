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

export interface ExtraImageSetting {
  focal_point: HeroFocalPoint;
  zoom: number;
  mobile_focal_point: HeroFocalPoint;
  mobile_zoom: number;
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
  /** Numeric stored by Neon as string. Coerce when reading. */
  zoom: number | string;
  mobile_focal_point: HeroFocalPoint;
  mobile_zoom: number | string;
  /** JSON array of per-image calibration for positions 1..N when the
   * admin wants to show multiple photos from a single event's gallery. */
  extra_image_settings: ExtraImageSetting[] | string;
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

function coerceExtraImages(v: ExtraImageSetting[] | string | null | undefined): ExtraImageSetting[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(normalizeExtra);
  try {
    const parsed = JSON.parse(v as string);
    return Array.isArray(parsed) ? parsed.map(normalizeExtra) : [];
  } catch {
    return [];
  }
}

function normalizeExtra(raw: unknown): ExtraImageSetting {
  const r = (raw ?? {}) as Partial<ExtraImageSetting>;
  const fp = typeof r.focal_point === "string" && isHeroFocalPoint(r.focal_point) ? r.focal_point : "center";
  const zoomNum = Number(r.zoom);
  const zoom = Number.isFinite(zoomNum) ? Math.max(0.5, Math.min(2, zoomNum)) : 1;
  // Mobile defaults to desktop values for legacy rows that lack the
  // mobile_* keys, so existing slides don't suddenly look broken.
  const mfp =
    typeof r.mobile_focal_point === "string" && isHeroFocalPoint(r.mobile_focal_point)
      ? r.mobile_focal_point
      : fp;
  const mZoomNum = Number(r.mobile_zoom);
  const mZoom = Number.isFinite(mZoomNum) ? Math.max(0.5, Math.min(2, mZoomNum)) : zoom;
  return { focal_point: fp, zoom, mobile_focal_point: mfp, mobile_zoom: mZoom };
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
  zoom: number;
  mobile_focal_point: HeroFocalPoint;
  mobile_zoom: number;
}

function coerceZoom(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.5, Math.min(2, n));
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

export function parseExtraImageSettings(v: ExtraImageSetting[] | string | null | undefined): ExtraImageSetting[] {
  return coerceExtraImages(v);
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
 * Each row may expand into multiple carousel slides when extra_image_settings
 * has entries — those pull additional photos from the linked event's gallery
 * with their own per-image focal_point + zoom calibration. */
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
    const extras = coerceExtraImages(r.extra_image_settings);
    const eventPhotos = r.event_id ? await getApprovedPhotosOrdered(r.event_id) : [];

    // Position 0: primary image (image_url override OR event's first photo).
    const primaryImage = r.image_url ?? eventPhotos[0]?.blob_url ?? null;
    const baseSlide = {
      eyebrow: r.eyebrow ?? (r.event_date ? formatHeroDate(r.event_date) : ""),
      title: r.title,
      emphasis: r.emphasis ?? "",
      byline: r.byline ?? "",
      cta_label: r.cta_label ?? "See more photos →",
      cta_href: r.cta_href ?? (r.event_slug ? `/events/${r.event_slug}/photos` : "/photos"),
    };
    resolved.push({
      ...baseSlide,
      image_url: primaryImage,
      focal_point: r.focal_point,
      zoom: coerceZoom(r.zoom),
      mobile_focal_point: r.mobile_focal_point ?? r.focal_point,
      mobile_zoom: coerceZoom(r.mobile_zoom),
    });

    // Positions 1..N: pull from the event's gallery in order, skipping
    // any photo that matches the primary's blob_url (so we don't show
    // the same photo twice).
    if (extras.length > 0 && eventPhotos.length > 0) {
      const primaryUrl = primaryImage ?? "";
      const remaining = eventPhotos.filter((p) => p.blob_url !== primaryUrl);
      for (let i = 0; i < extras.length && i < remaining.length; i++) {
        resolved.push({
          ...baseSlide,
          image_url: remaining[i].blob_url,
          focal_point: extras[i].focal_point,
          zoom: extras[i].zoom,
          mobile_focal_point: extras[i].mobile_focal_point,
          mobile_zoom: extras[i].mobile_zoom,
        });
      }
    }
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
      zoom: 1,
      mobile_focal_point: "center",
      mobile_zoom: 1,
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
  zoom: number;
  mobile_focal_point: HeroFocalPoint;
  mobile_zoom: number;
  extra_image_settings: ExtraImageSetting[];
  sort_order: number;
  enabled: boolean;
}

function serializeExtras(extras: ExtraImageSetting[]): string {
  return JSON.stringify(extras.map(normalizeExtra));
}

export async function createHeroSlide(data: HeroSlideInput): Promise<number> {
  const rows = (await sql`
    INSERT INTO homepage_hero_slides (
      event_id, eyebrow, title, emphasis, byline,
      cta_label, cta_href, image_url, focal_point, zoom,
      mobile_focal_point, mobile_zoom,
      extra_image_settings, sort_order, enabled
    ) VALUES (
      ${data.event_id}, ${data.eyebrow}, ${data.title}, ${data.emphasis}, ${data.byline},
      ${data.cta_label}, ${data.cta_href}, ${data.image_url}, ${data.focal_point},
      ${coerceZoom(data.zoom)},
      ${data.mobile_focal_point}, ${coerceZoom(data.mobile_zoom)},
      ${serializeExtras(data.extra_image_settings)}::jsonb,
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
      zoom        = ${coerceZoom(data.zoom)},
      mobile_focal_point = ${data.mobile_focal_point},
      mobile_zoom        = ${coerceZoom(data.mobile_zoom)},
      extra_image_settings = ${serializeExtras(data.extra_image_settings)}::jsonb,
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
