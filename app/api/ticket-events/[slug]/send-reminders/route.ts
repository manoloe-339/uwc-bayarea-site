import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getEventBySlug } from "@/lib/events-db";
import { generateMissingQRTokens, sendRemindersForEvent } from "@/lib/attendee-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  /** When true, also generate QR tokens for any eligible rows missing one. */
  generate_missing?: boolean;
  /** When true, include already-sent attendees (force resend). Default false. */
  include_sent?: boolean;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;

  let generated = 0;
  if (body.generate_missing) {
    generated = await generateMissingQRTokens(event.id);
  }

  const summary = await sendRemindersForEvent(
    {
      id: event.id,
      name: event.name,
      date: event.date,
      time: event.time,
      location: event.location,
    },
    { onlyUnsent: !body.include_sent, concurrency: 5 }
  );
  revalidatePath(`/admin/ticket-events/${slug}/communications`);
  revalidatePath(`/admin/ticket-events/${slug}/attendees`);
  return NextResponse.json({ generated, ...summary });
}
