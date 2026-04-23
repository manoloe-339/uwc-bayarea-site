import { NextResponse, type NextRequest } from "next/server";
import { getEventByCheckinToken, hasValidPinCookie, rateLimitSync } from "@/lib/checkin";
import { syncEventFromStripe } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const event = await getEventByCheckinToken(token);
  if (!event) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (!(await hasValidPinCookie(event))) {
    return NextResponse.json({ error: "PIN required" }, { status: 401 });
  }
  if (!event.stripe_payment_link_id) {
    return NextResponse.json(
      { error: "Event has no Stripe Payment Link configured" },
      { status: 400 }
    );
  }
  const limit = rateLimitSync(token);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryInSeconds: limit.retryInSeconds },
      { status: 429 }
    );
  }
  const summary = await syncEventFromStripe({
    id: event.id,
    slug: event.slug,
    name: event.name,
    stripe_payment_link_id: event.stripe_payment_link_id,
  });
  return NextResponse.json(summary);
}
