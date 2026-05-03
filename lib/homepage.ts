import { sql } from "./db";
import { getApprovedPhotosOrdered } from "./event-photos/queries";
import { findCountry } from "./countries";
import { isCardBackdrop, type CardBackdrop } from "./foodies-shared";

export interface FoodiesHost {
  id: number;
  first_name: string | null;
  last_name: string | null;
  grad_year: number | null;
  uwc_college: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
}

export interface FoodiesUpcoming {
  id: number;
  slug: string;
  name: string; // restaurant name
  date: Date;
  time: string | null;
  region: string | null;
  cuisine: string | null;
  neighborhood: string | null;
  /** Optional Google/Apple Maps link for the restaurant/location. */
  location_map_url: string | null;
  /** Free emoji to render inline with the title. */
  cuisine_emoji: string | null;
  /** Country flag derived from cuisine_country — rendered as a faint
   * backdrop in the bottom corner of the card. */
  cuisine_country_flag: string | null;
  card_backdrop: CardBackdrop;
  /** Photo URL used when card_backdrop = 'photo'. */
  card_backdrop_image_url: string | null;
  host_1: FoodiesHost | null;
  host_2: FoodiesHost | null;
}

export interface OtherGathering {
  id: number;
  slug: string;
  name: string;
  date: Date;
  time: string | null;
  location: string | null;
  location_map_url: string | null;
}

export interface RecentEventCover {
  id: number;
  slug: string;
  name: string;
  date: Date;
  location: string | null;
  cover_url: string | null;
}

export interface FoodiesPhoto {
  id: number;
  url: string;
}

export interface FoodiesEventLite {
  id: number;
  slug: string;
  name: string;
  date: Date;
}

/** Two display shapes for the "Recent Foodies" row at the bottom of
 * the Foodies section:
 *   - one_per_event: ≥2 past Foodies have photos; show 1 cover per event.
 *   - photos_from_latest: only 1 past Foodies has photos; show up to 4 of
 *     its photos, all linking to that event's gallery.
 *   - empty: no past Foodies have photos. Caller hides the row. */
export type RecentFoodiesDisplay =
  | { mode: "one_per_event"; events: RecentEventCover[] }
  | { mode: "photos_from_latest"; event: FoodiesEventLite; photos: FoodiesPhoto[] }
  | { mode: "empty" };

type FoodiesRow = {
  id: number;
  slug: string;
  name: string;
  date: Date;
  time: string | null;
  foodies_region: string | null;
  foodies_cuisine: string | null;
  foodies_neighborhood: string | null;
  location_map_url: string | null;
  cuisine_country: string | null;
  cuisine_emoji: string | null;
  card_backdrop: string | null;
  card_backdrop_image_url: string | null;
  h1_id: number | null;
  h1_first: string | null;
  h1_last: string | null;
  h1_grad: number | null;
  h1_college: string | null;
  h1_photo: string | null;
  h1_linkedin: string | null;
  h2_id: number | null;
  h2_first: string | null;
  h2_last: string | null;
  h2_grad: number | null;
  h2_college: string | null;
  h2_photo: string | null;
  h2_linkedin: string | null;
};

/** Upcoming Foodies meals — the cards on the homepage Foodies section.
 * Joined with both host alumni records so the cards can show photo + name + grad year. */
export async function getUpcomingFoodies(limit = 4): Promise<FoodiesUpcoming[]> {
  const rows = (await sql`
    SELECT
      e.id, e.slug, e.name, e.date, e.time,
      e.foodies_region, e.foodies_cuisine, e.foodies_neighborhood, e.location_map_url,
      e.cuisine_country, e.cuisine_emoji, e.card_backdrop, e.card_backdrop_image_url,
      h1.id AS h1_id, h1.first_name AS h1_first, h1.last_name AS h1_last,
      h1.grad_year AS h1_grad, h1.uwc_college AS h1_college, h1.photo_url AS h1_photo,
      h1.linkedin_url AS h1_linkedin,
      h2.id AS h2_id, h2.first_name AS h2_first, h2.last_name AS h2_last,
      h2.grad_year AS h2_grad, h2.uwc_college AS h2_college, h2.photo_url AS h2_photo,
      h2.linkedin_url AS h2_linkedin
    FROM events e
    LEFT JOIN alumni h1 ON h1.id = e.foodies_host_1_alumni_id
    LEFT JOIN alumni h2 ON h2.id = e.foodies_host_2_alumni_id
    WHERE e.is_foodies = TRUE
      AND e.date >= CURRENT_DATE
      AND e.slug <> 'archive'
    ORDER BY e.date ASC
    LIMIT ${limit}
  `) as FoodiesRow[];

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    date: r.date,
    time: r.time,
    region: r.foodies_region,
    cuisine: r.foodies_cuisine,
    neighborhood: r.foodies_neighborhood,
    location_map_url: r.location_map_url,
    cuisine_emoji: r.cuisine_emoji?.trim() || null,
    cuisine_country_flag: r.cuisine_country ? findCountry(r.cuisine_country)?.flag ?? null : null,
    card_backdrop: isCardBackdrop(r.card_backdrop ?? "") ? (r.card_backdrop as CardBackdrop) : "none",
    card_backdrop_image_url: r.card_backdrop_image_url?.trim() || null,
    host_1: r.h1_id
      ? {
          id: r.h1_id,
          first_name: r.h1_first,
          last_name: r.h1_last,
          grad_year: r.h1_grad,
          uwc_college: r.h1_college,
          photo_url: r.h1_photo,
          linkedin_url: r.h1_linkedin,
        }
      : null,
    host_2: r.h2_id
      ? {
          id: r.h2_id,
          first_name: r.h2_first,
          last_name: r.h2_last,
          grad_year: r.h2_grad,
          uwc_college: r.h2_college,
          photo_url: r.h2_photo,
          linkedin_url: r.h2_linkedin,
        }
      : null,
  }));
}

/** Upcoming events that are NOT Foodies (firesides, mixers, picnics, ticketed events).
 * Drives the "Other gatherings" section, which auto-hides when this returns []. */
export async function getOtherUpcomingGatherings(limit = 6): Promise<OtherGathering[]> {
  return (await sql`
    SELECT id, slug, name, date, time, location, location_map_url
    FROM events
    WHERE is_foodies = FALSE
      AND date >= CURRENT_DATE
      AND slug <> 'archive'
    ORDER BY date ASC
    LIMIT ${limit}
  `) as OtherGathering[];
}

/** Past Foodies events that have at least one approved photo, plus
 * one cover image per event. Drives the "one cover per event" mode of
 * the Recent Foodies row when ≥2 such events exist. */
export async function getRecentFoodiesCovers(limit = 4): Promise<RecentEventCover[]> {
  const rows = (await sql`
    WITH past_foodies AS (
      SELECT id, slug, name, date, location
      FROM events
      WHERE is_foodies = TRUE
        AND date < CURRENT_DATE
        AND slug <> 'archive'
      ORDER BY date DESC
      LIMIT ${limit}
    ),
    cover AS (
      SELECT DISTINCT ON (ep.event_id)
        ep.event_id, ep.blob_url
      FROM event_photos ep
      JOIN past_foodies pf ON pf.id = ep.event_id
      WHERE ep.approval_status = 'approved'
      ORDER BY ep.event_id,
        CASE WHEN ep.display_role = 'marquee' THEN 0 ELSE 1 END,
        ep.display_order ASC NULLS LAST,
        ep.id ASC
    )
    SELECT pf.id, pf.slug, pf.name, pf.date, pf.location, c.blob_url AS cover_url
    FROM past_foodies pf
    JOIN cover c ON c.event_id = pf.id
    ORDER BY pf.date DESC
  `) as RecentEventCover[];
  return rows;
}

/** Up to N approved photos from the most recent past Foodies event that
 * has any photos. Used for "photos from latest" mode when only one
 * past Foodies has photos. */
export async function getLatestFoodiesPhotoSet(
  perEvent = 4
): Promise<{ event: FoodiesEventLite; photos: FoodiesPhoto[] } | null> {
  const eventRows = (await sql`
    SELECT e.id, e.slug, e.name, e.date
    FROM events e
    WHERE e.is_foodies = TRUE
      AND e.date < CURRENT_DATE
      AND e.slug <> 'archive'
      AND EXISTS (
        SELECT 1 FROM event_photos ep
        WHERE ep.event_id = e.id AND ep.approval_status = 'approved'
      )
    ORDER BY e.date DESC
    LIMIT 1
  `) as FoodiesEventLite[];
  const event = eventRows[0];
  if (!event) return null;

  // Reuse the canonical event-gallery ordering helper so the homepage
  // row matches the public gallery exactly — marquee-tagged photos
  // first (in their tagged order), then non-marquee photos.
  const ordered = await getApprovedPhotosOrdered(event.id);
  const photos: FoodiesPhoto[] = ordered
    .slice(0, perEvent)
    .map((p) => ({ id: p.id, url: p.blob_url }));

  return { event, photos };
}

/** Resolve the right display shape for the Recent Foodies row.
 * Auto-falls back to "photos from latest" when only one past Foodies
 * event has photos — keeps the row populated until you have ≥2
 * past Foodies events with galleries. */
export async function getRecentFoodiesDisplay(): Promise<RecentFoodiesDisplay> {
  const covers = await getRecentFoodiesCovers(4);
  if (covers.length >= 2) {
    return { mode: "one_per_event", events: covers };
  }
  const latest = await getLatestFoodiesPhotoSet(4);
  if (!latest || latest.photos.length === 0) {
    return { mode: "empty" };
  }
  return { mode: "photos_from_latest", event: latest.event, photos: latest.photos };
}

/** Total active alumni — drives the "over 400 alumni" number in the Join interrupt. */
export async function getAlumniCount(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM alumni
    WHERE deceased IS NOT TRUE
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}
