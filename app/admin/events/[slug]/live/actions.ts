"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

export type BulkCheckInRef =
  | { kind: "attendee"; id: number }
  | { kind: "name_tag"; id: number };

/** Bulk check-in: handles both regular attendee rows and standalone
 * name tags (VIPs / guest speakers without ticket purchases). For
 * standalone tags, creates a comp attendee row and links the name
 * tag to it so the person is counted in stats and visible in the
 * attendees list going forward. */
export async function bulkCheckInAttendees(
  eventId: number,
  slug: string,
  refs: BulkCheckInRef[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!Array.isArray(refs) || refs.length === 0) {
    return { ok: false, count: 0, error: "No attendees selected." };
  }

  const attendeeIds = refs
    .filter((r) => r.kind === "attendee")
    .map((r) => r.id)
    .filter((n) => Number.isFinite(n) && n > 0);
  const nameTagIds = refs
    .filter((r) => r.kind === "name_tag")
    .map((r) => r.id)
    .filter((n) => Number.isFinite(n) && n > 0);

  let count = 0;

  try {
    if (attendeeIds.length > 0) {
      const updated = (await sql`
        UPDATE event_attendees
        SET checked_in = TRUE,
            checked_in_at = NOW(),
            updated_at = NOW()
        WHERE event_id = ${eventId}
          AND id = ANY(${attendeeIds})
          AND checked_in = FALSE
          AND deleted_at IS NULL
        RETURNING id
      `) as { id: number }[];
      count += updated.length;
    }

    // Standalone name tags: insert a comp attendee row per tag, then
    // back-link the tag to the new attendee so subsequent renders see
    // it as a regular checked-in attendee.
    for (const tagId of nameTagIds) {
      const tag = (await sql`
        SELECT id, first_name, last_name, uwc_college, grad_year
        FROM event_name_tags
        WHERE id = ${tagId} AND event_id = ${eventId} AND attendee_id IS NULL
        LIMIT 1
      `) as {
        id: number;
        first_name: string;
        last_name: string;
        uwc_college: string | null;
        grad_year: number | null;
      }[];
      const t = tag[0];
      if (!t) continue;
      const displayName = [t.first_name, t.last_name]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join(" ");
      const inserted = (await sql`
        INSERT INTO event_attendees (
          event_id, attendee_type,
          stripe_customer_name, amount_paid,
          checked_in, checked_in_at,
          match_status, match_confidence, match_reason
        ) VALUES (
          ${eventId}, 'comp',
          ${displayName || null}, 0,
          TRUE, NOW(),
          'unmatched', NULL, 'Standalone name tag — checked in via live dashboard'
        )
        RETURNING id
      `) as { id: number }[];
      const newAttendeeId = inserted[0]?.id;
      if (newAttendeeId) {
        await sql`
          UPDATE event_name_tags
          SET attendee_id = ${newAttendeeId}, updated_at = NOW()
          WHERE id = ${t.id}
        `;
        count += 1;
      }
    }

    revalidatePath(`/admin/events/${slug}/live`);
    revalidatePath(`/admin/events/${slug}/attendees`);
    return { ok: true, count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return { ok: false, count, error: msg };
  }
}
