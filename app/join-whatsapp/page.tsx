import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";
import { verifyWhatsappInviteToken } from "@/lib/whatsapp-invite-token";
import { sql } from "@/lib/db";
import JoinWhatsAppPageClient from "./JoinWhatsAppPageClient";

export const metadata: Metadata = {
  title: "Join UWC Bay Area WhatsApp",
  description:
    "Request access to the UWC Bay Area WhatsApp community — alumni-coordinated meals, events, and casual chat.",
};

export const dynamic = "force-dynamic";

type InvitePrefill = {
  token: string;
  firstName: string | null;
  email: string;
};

/** Verify the ?invite=<token> query param and look up the alum so we
 *  can prefill the modal with a trusted email + name. Returns null
 *  when the token is absent, expired, tampered with, or the alum
 *  doesn't exist any more — caller falls through to the standard
 *  "choose" entry view. */
async function resolveInvite(
  invite: string | undefined,
): Promise<InvitePrefill | null> {
  if (!invite) return null;
  const verified = await verifyWhatsappInviteToken(invite);
  if (!verified) return null;
  const rows = (await sql`
    SELECT email, first_name FROM alumni WHERE id = ${verified.alumniId} LIMIT 1
  `) as Array<{ email: string | null; first_name: string | null }>;
  const row = rows[0];
  if (!row || !row.email) return null;
  return { token: invite, firstName: row.first_name, email: row.email };
}

/**
 * Standalone deep-link entry point for the WhatsApp invite flow.
 *
 * Query params:
 *   ?registered=1  — open straight on the email-entry form (user
 *                    still types their name). Legacy direct link.
 *   ?invite=<sig>  — trusted prefill from the signup-confirmation
 *                    email. Auto-fills name + email and shows a
 *                    one-click "Send invite to <email>" button.
 */
export default async function JoinWhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; registered?: string }>;
}) {
  const sp = await searchParams;
  const [settings, invitePrefill] = await Promise.all([
    getSiteSettings(),
    resolveInvite(sp.invite),
  ]);
  return (
    <JoinWhatsAppPageClient
      whatsappUrl={settings.whatsapp_url ?? null}
      invitePrefill={invitePrefill}
    />
  );
}
