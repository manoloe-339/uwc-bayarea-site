import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { rematchAttendee } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  notes?: string | null;
  is_starred?: boolean;
  needs_followup?: boolean;
  alumni_id?: number | null;
  delete?: boolean;
  rematch?: boolean;
};

async function revalidateForId(id: number) {
  const rows = (await sql`
    SELECT e.slug FROM event_attendees a JOIN events e ON e.id = a.event_id WHERE a.id = ${id} LIMIT 1
  `) as { slug: string }[];
  if (rows[0]) {
    revalidatePath(`/admin/ticket-events/${rows[0].slug}/attendees`);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  if (body.delete === true) {
    await sql`UPDATE event_attendees SET deleted_at = NOW(), updated_at = NOW() WHERE id = ${id}`;
    await revalidateForId(id);
    return NextResponse.json({ ok: true });
  }

  if (body.rematch === true) {
    const result = await rematchAttendee(id);
    await revalidateForId(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, changed: result.changed, matchStatus: result.matchStatus });
  }

  // Apply whichever fields were provided. Using separate COALESCE-style
  // UPDATEs keeps the API small and avoids building dynamic SQL.
  if (body.notes !== undefined) {
    const notes = body.notes === null || body.notes === "" ? null : String(body.notes);
    await sql`UPDATE event_attendees SET notes = ${notes}, updated_at = NOW() WHERE id = ${id}`;
  }
  if (body.is_starred !== undefined) {
    await sql`UPDATE event_attendees SET is_starred = ${!!body.is_starred}, updated_at = NOW() WHERE id = ${id}`;
  }
  if (body.needs_followup !== undefined) {
    await sql`UPDATE event_attendees SET needs_followup = ${!!body.needs_followup}, updated_at = NOW() WHERE id = ${id}`;
  }
  if (body.alumni_id !== undefined) {
    // Explicit match override — stamp as manual confidence.
    const newAlumniId = body.alumni_id === null ? null : Number(body.alumni_id);
    if (newAlumniId !== null && !Number.isFinite(newAlumniId)) {
      return NextResponse.json({ error: "Invalid alumni_id" }, { status: 400 });
    }
    const status = newAlumniId === null ? "unmatched" : "matched";
    const confidence = newAlumniId === null ? null : "manual";
    const reason = newAlumniId === null ? "Manually cleared" : "Manually matched";
    await sql`
      UPDATE event_attendees
      SET alumni_id = ${newAlumniId},
          match_status = ${status},
          match_confidence = ${confidence},
          match_reason = ${reason},
          matched_at = ${newAlumniId === null ? null : new Date().toISOString()},
          updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  await revalidateForId(id);
  return NextResponse.json({ ok: true });
}
