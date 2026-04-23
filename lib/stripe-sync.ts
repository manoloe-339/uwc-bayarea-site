import type Stripe from "stripe";
import { sql } from "./db";
import { getStripe } from "./stripe";
import { matchAlumniForAttendee } from "./alumni-matcher";

export type SyncSummary = {
  scanned: number;
  created: number;
  updated: number;
  refunded: number;
  matchedHigh: number;
  matchedMedium: number;
  needsReview: number;
  unmatched: number;
  skipped: number;
  errors: string[];
};

export type EventRow = {
  id: number;
  slug: string;
  name: string;
  stripe_payment_link_id: string | null;
};

/**
 * Pull every checkout session created against the event's Payment Link,
 * upsert each one into event_attendees, and run the matcher on new rows.
 * Returns counts suitable for the admin sync-summary modal.
 */
export async function syncEventFromStripe(event: EventRow): Promise<SyncSummary> {
  const summary: SyncSummary = {
    scanned: 0,
    created: 0,
    updated: 0,
    refunded: 0,
    matchedHigh: 0,
    matchedMedium: 0,
    needsReview: 0,
    unmatched: 0,
    skipped: 0,
    errors: [],
  };

  if (!event.stripe_payment_link_id) {
    summary.errors.push("Event has no Stripe Payment Link configured");
    return summary;
  }

  const stripe = getStripe();

  // Pull the current price off the Payment Link so the admin doesn't have
  // to keep events.ticket_price in sync manually. Stripe stores unit_amount
  // in cents; stripe_price_id is the stable identifier for the price.
  try {
    const link = await stripe.paymentLinks.retrieve(event.stripe_payment_link_id, {
      expand: ["line_items.data.price"],
    });
    const firstItem = link.line_items?.data?.[0];
    const price = firstItem?.price ?? null;
    const unitAmount = price?.unit_amount ?? null;
    const priceDollars = unitAmount != null ? unitAmount / 100 : null;
    await sql`
      UPDATE events
      SET ticket_price = ${priceDollars},
          stripe_price_id = ${price?.id ?? null}
      WHERE id = ${event.id}
    `;
  } catch (err) {
    summary.errors.push(
      `Failed to read price from Payment Link: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Index existing rows once so the loop is O(1) per session.
  const existingRows = (await sql`
    SELECT id, stripe_session_id, amount_paid, refund_status, deleted_at
    FROM event_attendees
    WHERE event_id = ${event.id} AND stripe_session_id IS NOT NULL
  `) as {
    id: number;
    stripe_session_id: string;
    amount_paid: string;
    refund_status: string | null;
    deleted_at: Date | null;
  }[];
  const bySession = new Map(existingRows.map((r) => [r.stripe_session_id, r]));

  // Fetch all sessions for this Payment Link. Expand line_items so we know
  // how many tickets were bought; expand payment_intent.latest_charge so we
  // can detect refunds in one hop instead of a second charges.list call.
  let startingAfter: string | undefined;
  const sessions: Stripe.Checkout.Session[] = [];
  while (true) {
    const page = await stripe.checkout.sessions.list({
      payment_link: event.stripe_payment_link_id,
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.line_items", "data.payment_intent.latest_charge"],
    });
    sessions.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  summary.scanned = sessions.length;

  for (const session of sessions) {
    try {
      // Only care about completed payments. Open/expired sessions may exist
      // (someone clicked but didn't finish) — skip them.
      if (session.payment_status !== "paid") {
        summary.skipped++;
        continue;
      }

      const pi = asPaymentIntent(session.payment_intent);
      const latestCharge = pi ? asCharge(pi.latest_charge) : null;
      const amountRefunded = latestCharge?.amount_refunded ?? 0;
      const amountTotal = session.amount_total ?? 0;
      const refundStatus: string | null =
        amountRefunded === 0
          ? null
          : amountRefunded >= amountTotal
            ? "refunded"
            : "partially_refunded";
      const effectivePaidDollars = Math.max(0, (amountTotal - amountRefunded) / 100);

      const existing = bySession.get(session.id);

      if (existing) {
        // Update refund / amount if they've moved. Don't touch match metadata.
        if (existing.deleted_at) {
          summary.skipped++;
          continue;
        }
        const prevRefund = existing.refund_status ?? null;
        const prevAmount = Number(existing.amount_paid);
        if (prevRefund !== refundStatus || Math.abs(prevAmount - effectivePaidDollars) > 0.001) {
          await sql`
            UPDATE event_attendees
            SET amount_paid = ${effectivePaidDollars},
                refund_status = ${refundStatus},
                updated_at = NOW()
            WHERE id = ${existing.id}
          `;
          summary.updated++;
          if (refundStatus) summary.refunded++;
        }
        continue;
      }

      const email =
        session.customer_details?.email ??
        session.customer_email ??
        null;
      const name = session.customer_details?.name ?? null;
      const uwcCollege = extractUwcField(session.custom_fields ?? []);

      const match = await matchAlumniForAttendee({
        email,
        name,
        uwcCollege,
      });

      const customFieldsJson = JSON.stringify(session.custom_fields ?? []);
      const paidAt = new Date((session.created ?? 0) * 1000);

      await sql`
        INSERT INTO event_attendees (
          event_id, alumni_id, attendee_type,
          stripe_session_id, stripe_payment_intent_id,
          stripe_customer_email, stripe_customer_name, stripe_custom_fields,
          amount_paid, paid_at, refund_status,
          match_status, match_confidence, match_reason, matched_at
        ) VALUES (
          ${event.id}, ${match.alumniId}, 'paid',
          ${session.id}, ${pi?.id ?? null},
          ${email}, ${name}, ${customFieldsJson}::jsonb,
          ${effectivePaidDollars}, ${paidAt.toISOString()}, ${refundStatus},
          ${match.matchStatus}, ${match.matchConfidence}, ${match.matchReason},
          ${match.alumniId ? new Date().toISOString() : null}
        )
      `;

      summary.created++;
      if (refundStatus) summary.refunded++;
      if (match.matchConfidence === "high") summary.matchedHigh++;
      else if (match.matchConfidence === "medium") summary.matchedMedium++;
      if (match.matchStatus === "needs_review") summary.needsReview++;
      if (match.matchStatus === "unmatched") summary.unmatched++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`session ${session.id}: ${msg}`);
    }
  }

  // Recompute event totals from the attendee table. Excludes soft-deleted
  // rows and refunded tickets (amount_paid is already zeroed for those).
  const totals = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE attendee_type = 'paid')::int AS tickets,
      COALESCE(SUM(amount_paid) FILTER (WHERE attendee_type = 'paid'), 0)::numeric AS revenue
    FROM event_attendees
    WHERE event_id = ${event.id} AND deleted_at IS NULL
  `) as { tickets: number; revenue: string }[];

  await sql`
    UPDATE events
    SET total_tickets_sold = ${totals[0].tickets},
        total_revenue = ${totals[0].revenue},
        last_synced_at = NOW(),
        updated_at = NOW()
    WHERE id = ${event.id}
  `;

  return summary;
}

/**
 * Stripe custom-field keys are auto-derived from the label ("UWC affiliation
 * (school/year)" → "uwc_affiliation_school_year"). We match on substring
 * against both key and label so a label rename doesn't break sync.
 */
type CustomField = Stripe.Checkout.Session["custom_fields"][number];

function extractUwcField(fields: CustomField[]): string | null {
  for (const f of fields) {
    const key = (f.key ?? "").toLowerCase();
    const label = (f.label?.custom ?? "").toLowerCase();
    if (!key.includes("uwc") && !label.includes("uwc")) continue;
    const value =
      f.text?.value ??
      f.dropdown?.value ??
      f.numeric?.value ??
      null;
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function asPaymentIntent(pi: string | Stripe.PaymentIntent | null): Stripe.PaymentIntent | null {
  if (!pi || typeof pi === "string") return null;
  return pi;
}

function asCharge(c: string | Stripe.Charge | null | undefined): Stripe.Charge | null {
  if (!c || typeof c === "string") return null;
  return c;
}
