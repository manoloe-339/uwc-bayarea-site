import { sql } from "@/lib/db";

/** Single event admins have opted into the top nav via
 *  events.feature_in_nav. Picks the soonest date when multiple are on.
 *  Returns `null` when nothing is opted in — nav omits the item. */
export type FeaturedNavEvent = {
  label: string;
  href: string;
};

/** Fetch the current featured-nav event (if any). Called by
 *  SiteHeaderShell on every render — cached only by page-level ISR /
 *  force-dynamic settings. */
export async function getFeaturedNavEvent(): Promise<FeaturedNavEvent | null> {
  const rows = (await sql`
    SELECT slug, name, nav_label, nav_link_url
    FROM events
    WHERE feature_in_nav = TRUE
      AND slug <> 'archive'
    ORDER BY date ASC
    LIMIT 1
  `) as Array<{
    slug: string;
    name: string;
    nav_label: string | null;
    nav_link_url: string | null;
  }>;
  const row = rows[0];
  if (!row) return null;
  const rawLabel = (row.nav_label ?? row.name ?? "").trim();
  if (!rawLabel) return null;
  const href = (row.nav_link_url ?? "").trim() || `/events/${row.slug}/photos`;
  return { label: rawLabel, href };
}
