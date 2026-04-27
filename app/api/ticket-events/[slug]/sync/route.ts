import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getEventBySlug } from "@/lib/events-db";
import { syncEventFromStripe } from "@/lib/stripe-sync";

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
  if (!event.stripe_payment_link_id) {
    return NextResponse.json(
      { error: "Event has no Stripe Payment Link configured" },
      { status: 400 }
    );
  }
  const summary = await syncEventFromStripe({
    id: event.id,
    slug: event.slug,
    name: event.name,
    stripe_payment_link_id: event.stripe_payment_link_id,
  });
  revalidatePath(`/admin/events/${slug}/attendees`);
  revalidatePath("/admin/events");
  return NextResponse.json(summary);
}
