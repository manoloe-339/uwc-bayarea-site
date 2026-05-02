import { sql } from "./db";

export interface FoodiesHost {
  id: number;
  first_name: string | null;
  last_name: string | null;
  grad_year: number | null;
  uwc_college: string | null;
  photo_url: string | null;
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

type FoodiesRow = {
  id: number;
  slug: string;
  name: string;
  date: Date;
  time: string | null;
  foodies_region: string | null;
  foodies_cuisine: string | null;
  foodies_neighborhood: string | null;
  h1_id: number | null;
  h1_first: string | null;
  h1_last: string | null;
  h1_grad: number | null;
  h1_college: string | null;
  h1_photo: string | null;
  h2_id: number | null;
  h2_first: string | null;
  h2_last: string | null;
  h2_grad: number | null;
  h2_college: string | null;
  h2_photo: string | null;
};

/** Upcoming Foodies meals — the cards on the homepage Foodies section.
 * Joined with both host alumni records so the cards can show photo + name + grad year. */
export async function getUpcomingFoodies(limit = 4): Promise<FoodiesUpcoming[]> {
  const rows = (await sql`
    SELECT
      e.id, e.slug, e.name, e.date, e.time,
      e.foodies_region, e.foodies_cuisine, e.foodies_neighborhood,
      h1.id AS h1_id, h1.first_name AS h1_first, h1.last_name AS h1_last,
      h1.grad_year AS h1_grad, h1.uwc_college AS h1_college, h1.photo_url AS h1_photo,
      h2.id AS h2_id, h2.first_name AS h2_first, h2.last_name AS h2_last,
      h2.grad_year AS h2_grad, h2.uwc_college AS h2_college, h2.photo_url AS h2_photo
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
    host_1: r.h1_id
      ? {
          id: r.h1_id,
          first_name: r.h1_first,
          last_name: r.h1_last,
          grad_year: r.h1_grad,
          uwc_college: r.h1_college,
          photo_url: r.h1_photo,
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

/** Past events from the last ~4 months that have at least one approved
 * cover-style photo, with that photo's blob URL. Drives the
 * "Recent events" thumbnail row at the bottom of the Foodies section. */
export async function getRecentEventCovers(limit = 4): Promise<RecentEventCover[]> {
  const rows = (await sql`
    WITH recent AS (
      SELECT id, slug, name, date, location
      FROM events
      WHERE date < CURRENT_DATE
        AND date >= CURRENT_DATE - INTERVAL '120 days'
        AND slug <> 'archive'
      ORDER BY date DESC
      LIMIT ${limit}
    ),
    cover AS (
      SELECT DISTINCT ON (ep.event_id)
        ep.event_id, ep.blob_url
      FROM event_photos ep
      JOIN recent r ON r.id = ep.event_id
      WHERE ep.approval_status = 'approved'
      ORDER BY ep.event_id,
        CASE WHEN ep.display_role = 'marquee' THEN 0 ELSE 1 END,
        ep.display_order ASC NULLS LAST,
        ep.id ASC
    )
    SELECT r.id, r.slug, r.name, r.date, r.location, c.blob_url AS cover_url
    FROM recent r
    LEFT JOIN cover c ON c.event_id = r.id
    ORDER BY r.date DESC
  `) as RecentEventCover[];
  return rows;
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
