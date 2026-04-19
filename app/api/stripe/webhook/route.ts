import { NextRequest } from "next/server";
import Stripe from "stripe";
import { incrementTicketsSold } from "@/lib/live";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return new Response("Stripe env not configured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const stripe = new Stripe(secretKey);
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`Webhook error: ${msg}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      const qty =
        session.line_items?.data?.reduce((n, li) => n + (li.quantity ?? 0), 0) ?? 1;
      await incrementTicketsSold(qty > 0 ? qty : 1);
    }
  }

  return new Response("ok");
}
