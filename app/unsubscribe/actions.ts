"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import {
  verifyUnsubscribeToken,
} from "@/lib/unsubscribe-token";
import { UNSUBSCRIBE_REASONS } from "@/lib/unsubscribe-reasons";

const VALID_CODES = new Set(UNSUBSCRIBE_REASONS.map((r) => r.code));

function pickReason(raw: string | null): string {
  if (raw && VALID_CODES.has(raw as (typeof UNSUBSCRIBE_REASONS)[number]["code"])) {
    return raw;
  }
  return "not_provided";
}

export async function confirmUnsubscribe(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const result = verifyUnsubscribeToken(typeof token === "string" ? token : null);
  if (!result.ok) {
    redirect("/unsubscribe?error=1");
  }

  const reason = pickReason(typeof formData.get("reason") === "string" ? (formData.get("reason") as string) : null);
  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim().slice(0, 2000) : null;

  const rows = (await sql`SELECT id, subscribed FROM alumni WHERE id = ${result.alumniId}`) as {
    id: number; subscribed: boolean | null;
  }[];
  if (rows.length === 0) {
    redirect("/unsubscribe?error=1");
  }

  await sql`
    UPDATE alumni SET
      subscribed         = FALSE,
      unsubscribed_at    = NOW(),
      unsubscribe_reason = ${reason},
      unsubscribe_note   = ${note}
    WHERE id = ${result.alumniId}
  `;
  if (reason === "moved") {
    await sql`UPDATE alumni SET moved_out = TRUE WHERE id = ${result.alumniId}`;
  }

  await sql`
    INSERT INTO unsubscribe_events (alumni_id, event_type, reason, note)
    VALUES (${result.alumniId}, 'unsubscribe', ${reason}, ${note})
  `;

  console.log(
    `[unsubscribe] alumni_id=${result.alumniId} reason=${reason} token_age=${result.ageSeconds}s`
  );

  redirect("/unsubscribe/confirmed");
}

export async function manualUnsubscribe(formData: FormData): Promise<void> {
  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const reason = pickReason(
    typeof formData.get("reason") === "string" ? (formData.get("reason") as string) : null
  );
  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim().slice(0, 2000) : null;

  if (email) {
    const rows = (await sql`SELECT id FROM alumni WHERE lower(email) = ${email}`) as { id: number }[];
    if (rows.length > 0) {
      const alumniId = rows[0].id;
      const setMovedOut = reason === "moved";
      await sql`
        UPDATE alumni SET
          subscribed         = FALSE,
          unsubscribed_at    = NOW(),
          unsubscribe_reason = ${reason},
          unsubscribe_note   = ${note}
        WHERE id = ${alumniId}
      `;
      if (setMovedOut) {
        await sql`UPDATE alumni SET moved_out = TRUE WHERE id = ${alumniId}`;
      }
      await sql`
        INSERT INTO unsubscribe_events (alumni_id, event_type, reason, note)
        VALUES (${alumniId}, 'unsubscribe_manual', ${reason}, ${note})
      `;
      console.log(`[unsubscribe_manual] alumni_id=${alumniId} reason=${reason}`);
    } else {
      console.log(`[unsubscribe_manual] email not found (no leak): hashed=${email.length}`);
    }
  }

  // Always show success (no enumeration).
  redirect("/unsubscribe/confirmed?manual=1");
}

export async function resubscribe(alumniId: number): Promise<void> {
  await sql`
    UPDATE alumni SET
      subscribed         = TRUE,
      unsubscribed_at    = NULL,
      unsubscribe_reason = NULL,
      unsubscribe_note   = NULL
    WHERE id = ${alumniId}
  `;
  await sql`
    INSERT INTO unsubscribe_events (alumni_id, event_type, reason, note)
    VALUES (${alumniId}, 'resubscribe', NULL, NULL)
  `;
  console.log(`[resubscribe] alumni_id=${alumniId}`);
}
