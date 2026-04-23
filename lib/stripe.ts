import Stripe from "stripe";

/**
 * Lazily-instantiated Stripe client. Reads STRIPE_SECRET_KEY — which is
 * already used by the checkout-webhook route and the ticket-countdown.
 * Throws a clear error if the key is missing, so callers don't silently
 * no-op against a placeholder client.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  cached = new Stripe(key);
  return cached;
}
