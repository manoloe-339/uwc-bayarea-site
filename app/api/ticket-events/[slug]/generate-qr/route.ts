import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getEventBySlug } from "@/lib/events-db";
import { generateMissingQRTokens } from "@/lib/attendee-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  try {
    const generated = await generateMissingQRTokens(event.id);
    revalidatePath(`/admin/events/${slug}/communications`);
    revalidatePath(`/admin/events/${slug}/attendees`);
    return NextResponse.json({ generated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
