"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

/** Bulk check-in: mark a set of attendee rows as checked_in = TRUE
 * with checked_in_at = NOW(). Skips rows already checked in. Used by
 * the live dashboard's post-event "tick the attendees who showed up"
 * affordance. */
export async function bulkCheckInAttendees(
  eventId: number,
  slug: string,
  attendeeIds: number[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  const ids = attendeeIds.filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) {
    return { ok: false, count: 0, error: "No attendees selected." };
  }
  try {
    const rows = (await sql`
      UPDATE event_attendees
      SET checked_in = TRUE,
          checked_in_at = NOW(),
          updated_at = NOW()
      WHERE event_id = ${eventId}
        AND id = ANY(${ids})
        AND checked_in = FALSE
        AND deleted_at IS NULL
      RETURNING id
    `) as { id: number }[];
    revalidatePath(`/admin/events/${slug}/live`);
    revalidatePath(`/admin/events/${slug}/attendees`);
    return { ok: true, count: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return { ok: false, count: 0, error: msg };
  }
}
