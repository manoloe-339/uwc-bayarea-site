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

  if (!name || !date) throw new Error("Name and date are required");
  const slug = slugify(slugRaw || name);
  if (!slug) throw new Error("Could not derive slug");

  // ticket_price / stripe_price_id are populated by the sync endpoint
  // from the Payment Link — no manual entry.
  await sql`
    INSERT INTO events (slug, name, date, time, location, description, stripe_payment_link_id)
    VALUES (${slug}, ${name}, ${date}, ${time}, ${location}, ${description}, ${stripeLink})
  `;
  revalidatePath("/admin/ticket-events");
  redirect(`/admin/ticket-events/${slug}/attendees`);
}

export async function updateEventAction(id: number, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const stripeLink = String(formData.get("stripe_payment_link_id") ?? "").trim() || null;

  if (!name || !date) throw new Error("Name and date are required");

  // ticket_price is managed by the sync endpoint; don't touch it here.
  const rows = (await sql`
    UPDATE events SET
      name = ${name}, date = ${date}, time = ${time}, location = ${location},
      description = ${description}, stripe_payment_link_id = ${stripeLink},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING slug
  `) as { slug: string }[];

  if (!rows[0]) throw new Error("Event not found");
  revalidatePath("/admin/ticket-events");
  revalidatePath(`/admin/ticket-events/${rows[0].slug}/attendees`);
  redirect(`/admin/ticket-events/${rows[0].slug}/attendees`);
}
