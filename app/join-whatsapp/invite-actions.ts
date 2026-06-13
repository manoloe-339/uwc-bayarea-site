"use server";

import { sql } from "@/lib/db";
import { verifyWhatsappInviteToken } from "@/lib/whatsapp-invite-token";
import { sendWhatsappInviteToAlum } from "@/lib/whatsapp-invite-send";
import {
  findPendingRequestForAlumni,
  markRegisteredWhatsappRequestSent,
} from "@/lib/whatsapp-requests";

/**
 * Trusted-token path: someone clicked the {whatsapp_link} in their
 * signup-confirmation email, the modal verified the token server-
 * side, and now they've clicked "Send WhatsApp invite to me". We
 * already know who they are — fire the invite immediately and skip
 * the admin-review step the public registered-alum form goes
 * through.
 *
 * Returns { ok: false } on every recoverable failure so the client
 * can surface a useful error without throwing.
 */
export async function sendInviteFromToken(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log("[invite-send] sendInviteFromToken invoked");
  const verified = await verifyWhatsappInviteToken(token);
  if (!verified) {
    console.warn("[invite-send] token verification failed");
    return { ok: false, error: "Invalid or expired invite link." };
  }
  console.log(`[invite-send] verified alumniId=${verified.alumniId}`);

  const rows = (await sql`
    SELECT id, email, first_name, last_name, uwc_college, grad_year
      FROM alumni WHERE id = ${verified.alumniId} LIMIT 1
  `) as Array<{
    id: number;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    uwc_college: string | null;
    grad_year: number | null;
  }>;
  const alum = rows[0];
  if (!alum) {
    console.warn(`[invite-send] alumni row ${verified.alumniId} not found`);
    return { ok: false, error: "Alumni record not found." };
  }
  if (!alum.email) {
    console.warn(`[invite-send] alumni ${alum.id} has no email`);
    return { ok: false, error: "No email on file for this alum." };
  }
  console.log(`[invite-send] sending to ${alum.email}`);

  const result = await sendWhatsappInviteToAlum({
    alumni_id: alum.id,
    email: alum.email,
    first_name: alum.first_name,
    last_name: alum.last_name,
    uwc_college: alum.uwc_college,
    grad_year: alum.grad_year,
    raw_name:
      [alum.first_name, alum.last_name].filter(Boolean).join(" ") || alum.email,
  });
  console.log(`[invite-send] sendWhatsappInviteToAlum returned ok=${result.ok}`);
  if (!result.ok) return result;

  // Best-effort: if there's a pending public request row for this
  // alum (they hit the registered-form path before clicking the
  // trusted link), mark it sent so the admin doesn't see a stale
  // todo. Failure here doesn't change the user-facing outcome.
  try {
    const pending = await findPendingRequestForAlumni(alum.id);
    if (pending) {
      await markRegisteredWhatsappRequestSent(pending.id);
    }
  } catch {
    // ignore
  }

  return { ok: true };
}
