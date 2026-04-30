"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function createEventAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const stripeLink = String(formData.get("stripe_payment_link_id") ?? "").trim() || null;
  const eventTypeRaw = String(formData.get("event_type") ?? "ticketed").trim();
  const eventType = eventTypeRaw === "casual" ? "casual" : "ticketed";

  if (!name || !date) throw new Error("Name and date are required");
  const slug = slugify(slugRaw || name);
  if (!slug) throw new Error("Could not derive slug");

  // ticket_price / stripe_price_id are populated by the sync endpoint
  // from the Payment Link — no manual entry. Casual events get NULL
  // Stripe fields regardless of whether something was pasted.
  const finalStripeLink = eventType === "casual" ? null : stripeLink;
  await sql`
    INSERT INTO events (slug, name, date, time, location, description, stripe_payment_link_id, event_type)
    VALUES (${slug}, ${name}, ${date}, ${time}, ${location}, ${description}, ${finalStripeLink}, ${eventType})
  `;
  revalidatePath("/admin/events");
  redirect(`/admin/events/${slug}/attendees`);
}

export async function updateEventAction(id: number, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const locationMapUrl = String(formData.get("location_map_url") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const stripeLink = String(formData.get("stripe_payment_link_id") ?? "").trim() || null;
  const eventTypeRaw = String(formData.get("event_type") ?? "ticketed").trim();
  const eventType = eventTypeRaw === "casual" ? "casual" : "ticketed";

  if (!name || !date) throw new Error("Name and date are required");

  // ticket_price is managed by the sync endpoint; don't touch it here.
  // Switching to casual nulls the Stripe link to keep the data clean.
  const finalStripeLink = eventType === "casual" ? null : stripeLink;
  const rows = (await sql`
    UPDATE events SET
      name = ${name}, date = ${date}, time = ${time}, location = ${location},
      location_map_url = ${locationMapUrl},
      description = ${description}, stripe_payment_link_id = ${finalStripeLink},
      event_type = ${eventType},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING slug
  `) as { slug: string }[];

  if (!rows[0]) throw new Error("Event not found");
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${rows[0].slug}/attendees`);
  redirect(`/admin/events/${rows[0].slug}/attendees`);
}
