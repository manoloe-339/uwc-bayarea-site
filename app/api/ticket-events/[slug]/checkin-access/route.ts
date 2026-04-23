import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getEventBySlug } from "@/lib/events-db";
import { generateCheckinToken } from "@/lib/checkin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action: "generate" | "regenerate" | "set_pin" | "clear";
  pin?: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Body;

  if (body.action === "generate" || body.action === "regenerate") {
    // Retry on unique-violation — astronomically unlikely at 32^8 but free.
    for (let i = 0; i < 5; i++) {
      const token = generateCheckinToken();
      try {
        await sql`
          UPDATE events
          SET checkin_token = ${token},
              checkin_token_generated_at = NOW(),
              updated_at = NOW()
          WHERE id = ${event.id}
        `;
        revalidatePath(`/admin/ticket-events/${slug}/attendees`);
        return NextResponse.json({ ok: true, token });
      } catch (err) {
        if (i === 4) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed" },
            { status: 500 }
          );
        }
      }
    }
  }

  if (body.action === "clear") {
    await sql`
      UPDATE events
      SET checkin_token = NULL,
          checkin_pin = NULL,
          checkin_token_generated_at = NULL,
          updated_at = NOW()
      WHERE id = ${event.id}
    `;
    revalidatePath(`/admin/ticket-events/${slug}/attendees`);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_pin") {
    const raw = body.pin == null ? null : String(body.pin).trim();
    if (raw !== null && !/^\d{4}$/.test(raw)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
    }
    await sql`
      UPDATE events
      SET checkin_pin = ${raw || null}, updated_at = NOW()
      WHERE id = ${event.id}
    `;
    revalidatePath(`/admin/ticket-events/${slug}/attendees`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
