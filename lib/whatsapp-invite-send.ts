/**
 * Shared "send the WhatsApp invite email" helper. Used by:
 *
 *  - The admin tool at /admin/tools/whatsapp — manual approval path
 *    when a registered alum requests an invite via the homepage modal.
 *  - The trusted-token /join-whatsapp?invite=… path — fired
 *    automatically when a freshly-signed-up alum clicks the link in
 *    their confirmation email (we already know who they are, so no
 *    admin step is needed).
 *
 * Both paths must render the same email body, log the same audit row,
 * and notify the admin the same way — keeping the logic here ensures
 * they don't drift apart.
 */
import { sql } from "@/lib/db";
import { sendTestEmail } from "@/lib/email-send";
import {
  renderSimpleMarkdown,
  EMAIL_LINK_ATTRS,
  EMAIL_PARAGRAPH_ATTRS,
} from "@/lib/simple-markdown";
import { getSiteSettings, DEFAULT_WHATSAPP_INVITE } from "@/lib/settings";
import { ensureParagraphBreaks } from "@/lib/signup-confirmation";

const ADMIN_EMAIL = "manoloe@gmail.com";

export type AlumInvitePayload = {
  alumni_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  raw_name: string;
};

function applyWhatsappPlaceholders(
  md: string,
  ctx: { whatsappUrl: string },
): string {
  return md.replaceAll("{whatsapp_url}", ctx.whatsappUrl);
}

/** How recently we'll silently dedupe a duplicate send to the same
 * alum. 1 hour catches the common double-click / refresh-and-retry
 * pattern without blocking a legitimate later re-send. */
const WHATSAPP_DEDUP_WINDOW_MINUTES = 60;

export async function sendWhatsappInviteToAlum(
  alum: AlumInvitePayload,
  opts: { force?: boolean } = {},
): Promise<
  | { ok: true; deduped?: boolean }
  | { ok: false; error: string }
> {
  // Guard against double-fires: if a WhatsApp invite already went to
  // this alum within the dedup window, return ok without sending
  // again. Pass { force: true } to bypass (admin re-send path).
  if (!opts.force) {
    try {
      const recent = (await sql`
        SELECT id FROM email_sends
        WHERE alumni_id = ${alum.alumni_id}
          AND kind = 'whatsapp_invite'
          AND status = 'sent'
          AND sent_at > NOW() - (${WHATSAPP_DEDUP_WINDOW_MINUTES} || ' minutes')::interval
        LIMIT 1
      `) as Array<{ id: string }>;
      if (recent.length > 0) {
        console.log(
          `[whatsapp-invite] dedup hit for alumni=${alum.alumni_id} — already sent in last ${WHATSAPP_DEDUP_WINDOW_MINUTES}min, skipping`,
        );
        return { ok: true, deduped: true };
      }
    } catch (err) {
      // Dedup query failure shouldn't block a legitimate send — log
      // and continue.
      console.warn(
        `[whatsapp-invite] dedup check failed for alumni=${alum.alumni_id}:`,
        err,
      );
    }
  }

  const settings = await getSiteSettings();
  const subject =
    (settings.whatsapp_invite_subject ?? "").trim() ||
    DEFAULT_WHATSAPP_INVITE.subject;
  const bodyMd =
    (settings.whatsapp_invite_body_md ?? "").trim() ||
    DEFAULT_WHATSAPP_INVITE.bodyMd;
  const whatsappUrl = (settings.whatsapp_url ?? "").trim();
  const resolvedMd = ensureParagraphBreaks(
    applyWhatsappPlaceholders(bodyMd, { whatsappUrl }),
  );
  const bodyHtml = renderSimpleMarkdown(
    resolvedMd,
    EMAIL_LINK_ATTRS,
    EMAIL_PARAGRAPH_ATTRS,
  );

  const result = await sendTestEmail({
    to: alum.email,
    subject,
    bodyHtml,
    textFallback: resolvedMd,
    salutation: "Hi",
    includeFirstName: true,
    firstName: alum.first_name,
    logTo: { alumniId: alum.alumni_id, kind: "whatsapp_invite" },
  });
  if (!result.ok) return { ok: false, error: result.error };

  const fullName =
    [alum.first_name, alum.last_name].filter(Boolean).join(" ") ||
    alum.raw_name;
  const adminBody = [
    `Sent the WhatsApp invite email to:`,
    ``,
    `Name:    ${fullName}`,
    `Email:   ${alum.email}`,
    `College: ${alum.uwc_college ?? "—"}${alum.grad_year ? ` · ${alum.grad_year}` : ""}`,
    ``,
    `View / undo: https://uwcbayarea.org/admin/tools/whatsapp?tab=requests`,
  ].join("\n");
  void sendTestEmail({
    to: ADMIN_EMAIL,
    subject: `WhatsApp invite sent · ${fullName}`,
    body: adminBody,
    salutation: "",
    includeFirstName: false,
  }).then((r) => {
    if (!r.ok)
      console.warn(`[whatsapp-invite] admin notification failed: ${r.error}`);
  });
  return { ok: true };
}
