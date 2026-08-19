/**
 * Grounding data for the AI newsletter composer. Every chat turn
 * feeds these into the system prompt so Claude can reference real
 * events, real hosts, real photos, real past newsletters — no
 * hallucination of dates or people.
 */
import { sql } from "@/lib/db";

export type GroundingEvent = {
  id: number;
  slug: string;
  name: string;
  date: string; // ISO
  time: string | null;
  location: string | null;
  is_foodies: boolean;
  foodies_region: string | null;
  foodies_cuisine: string | null;
  cuisine_country: string | null;
  cuisine_emoji: string | null;
  hosts: string[]; // resolved first-last strings
  cover_url: string | null; // top approved gallery photo (null if none)
  gallery_url: string; // /events/<slug>/photos
};

export type PastNewsletterExample = {
  id: string;
  subject: string;
  sent_at: string | null;
  preview: string; // first 500 chars of a rendered snippet
};

/** Upcoming events + hosts + optional cover, capped at `limit`. */
export async function listUpcomingEventsForAI(limit = 8): Promise<GroundingEvent[]> {
  const rows = (await sql`
    SELECT id, slug, name, date, time, location, is_foodies,
           foodies_region, foodies_cuisine, cuisine_country, cuisine_emoji,
           foodies_host_1_alumni_id, foodies_host_2_alumni_id
    FROM events
    WHERE date >= CURRENT_DATE
      AND slug <> 'archive'
    ORDER BY date ASC
    LIMIT ${limit}
  `) as Array<{
    id: number;
    slug: string;
    name: string;
    date: string | Date;
    time: string | null;
    location: string | null;
    is_foodies: boolean;
    foodies_region: string | null;
    foodies_cuisine: string | null;
    cuisine_country: string | null;
    cuisine_emoji: string | null;
    foodies_host_1_alumni_id: number | null;
    foodies_host_2_alumni_id: number | null;
  }>;
  return withHostsAndCovers(rows);
}

/** Past events since `sinceISO` (or last 60 days if unset), most-recent
 *  first. Includes hosts + one cover photo per event. */
export async function listPastEventsForAI(sinceISO?: string, limit = 8): Promise<GroundingEvent[]> {
  const since = sinceISO ?? new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const rows = (await sql`
    SELECT id, slug, name, date, time, location, is_foodies,
           foodies_region, foodies_cuisine, cuisine_country, cuisine_emoji,
           foodies_host_1_alumni_id, foodies_host_2_alumni_id
    FROM events
    WHERE date < CURRENT_DATE
      AND date >= ${since}::date
      AND slug <> 'archive'
    ORDER BY date DESC
    LIMIT ${limit}
  `) as Array<{
    id: number;
    slug: string;
    name: string;
    date: string | Date;
    time: string | null;
    location: string | null;
    is_foodies: boolean;
    foodies_region: string | null;
    foodies_cuisine: string | null;
    cuisine_country: string | null;
    cuisine_emoji: string | null;
    foodies_host_1_alumni_id: number | null;
    foodies_host_2_alumni_id: number | null;
  }>;
  return withHostsAndCovers(rows);
}

/** Resolve host names + top gallery cover in a single pass per set. */
async function withHostsAndCovers(rows: Array<{
  id: number;
  slug: string;
  name: string;
  date: string | Date;
  time: string | null;
  location: string | null;
  is_foodies: boolean;
  foodies_region: string | null;
  foodies_cuisine: string | null;
  cuisine_country: string | null;
  cuisine_emoji: string | null;
  foodies_host_1_alumni_id: number | null;
  foodies_host_2_alumni_id: number | null;
}>): Promise<GroundingEvent[]> {
  if (rows.length === 0) return [];
  const eventIds = rows.map((r) => r.id);
  const hostIds = Array.from(new Set(
    rows.flatMap((r) => [r.foodies_host_1_alumni_id, r.foodies_host_2_alumni_id]).filter((v): v is number => v != null),
  ));
  const hostQuery = hostIds.length
    ? sql`SELECT id, first_name, last_name FROM alumni WHERE id = ANY(${hostIds})`
    : Promise.resolve([]);
  const coverQuery = sql`
    WITH ranked AS (
      SELECT ep.event_id, ep.blob_url,
             ROW_NUMBER() OVER (
               PARTITION BY ep.event_id
               ORDER BY
                 CASE WHEN ep.display_role = 'marquee' THEN 0 ELSE 1 END,
                 ep.display_order ASC NULLS LAST,
                 COALESCE(ep.taken_at, ep.uploaded_at) DESC,
                 ep.id DESC
             ) AS rn
      FROM event_photos ep
      WHERE ep.event_id = ANY(${eventIds}) AND ep.approval_status = 'approved'
    )
    SELECT event_id, blob_url FROM ranked WHERE rn = 1
  `;
  const [hostRowsRaw, coverRowsRaw] = await Promise.all([hostQuery, coverQuery]);
  const hostRows = hostRowsRaw as Array<{ id: number; first_name: string | null; last_name: string | null }>;
  const coverRows = coverRowsRaw as Array<{ event_id: number; blob_url: string }>;
  const hostById = new Map(hostRows.map((h) => [h.id, [h.first_name, h.last_name].filter(Boolean).join(" ")]));
  const coverById = new Map(coverRows.map((c) => [c.event_id, c.blob_url]));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    date: new Date(r.date).toISOString(),
    time: r.time,
    location: r.location,
    is_foodies: r.is_foodies,
    foodies_region: r.foodies_region,
    foodies_cuisine: r.foodies_cuisine,
    cuisine_country: r.cuisine_country,
    cuisine_emoji: r.cuisine_emoji,
    hosts: [r.foodies_host_1_alumni_id, r.foodies_host_2_alumni_id]
      .map((id) => (id != null ? hostById.get(id) : null))
      .filter((v): v is string => !!v),
    cover_url: coverById.get(r.id) ?? null,
    gallery_url: `/events/${r.slug}/photos`,
  }));
}

/** Last N *sent* newsletter campaigns as style examples. Body preview
 *  is a truncated plain-text extract from the rendered HTML body. */
export async function listPastNewslettersForAI(limit = 3): Promise<PastNewsletterExample[]> {
  const rows = (await sql`
    SELECT c.id, c.subject, c.body,
           COALESCE(c.sent_at, c.created_at) AS at
    FROM email_campaigns c
    WHERE c.status = 'sent'
      AND c.format = 'newsletter'
    ORDER BY COALESCE(c.sent_at, c.created_at) DESC
    LIMIT ${limit}
  `) as Array<{ id: string; subject: string; body: string; at: string | Date }>;
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    sent_at: r.at instanceof Date ? r.at.toISOString() : String(r.at),
    preview: (r.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 700),
  }));
}

/** Look up alumni by name (case-insensitive substring) for the "special
 *  alum" workflow. Returns up to 5. */
export async function searchAlumniByName(query: string): Promise<Array<{
  id: number;
  first_name: string | null;
  last_name: string | null;
  linkedin_url: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  current_company: string | null;
  current_title: string | null;
  linkedin_about: string | null;
}>> {
  const q = `%${query.toLowerCase()}%`;
  return (await sql`
    SELECT id, first_name, last_name, linkedin_url, uwc_college, grad_year,
           current_company, current_title, linkedin_about
    FROM alumni
    WHERE LOWER(first_name || ' ' || last_name) LIKE ${q}
       OR LOWER(first_name) LIKE ${q}
       OR LOWER(last_name)  LIKE ${q}
    ORDER BY updated_at DESC
    LIMIT 5
  `) as Array<{
    id: number;
    first_name: string | null;
    last_name: string | null;
    linkedin_url: string | null;
    uwc_college: string | null;
    grad_year: number | null;
    current_company: string | null;
    current_title: string | null;
    linkedin_about: string | null;
  }>;
}
