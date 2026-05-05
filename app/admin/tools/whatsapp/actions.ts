"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendTestEmail } from "@/lib/email-send";
import {
  renderSimpleMarkdown,
  EMAIL_LINK_ATTRS,
  EMAIL_PARAGRAPH_ATTRS,
} from "@/lib/simple-markdown";
import {
  getSiteSettings,
  updateSiteSettings,
  DEFAULT_WHATSAPP_INVITE,
} from "@/lib/settings";
import { ensureParagraphBreaks } from "@/lib/signup-confirmation";
import { setVisitingRequestContacted } from "@/lib/visiting-requests";
import {
  clearRegisteredWhatsappRequestSent,
  markRegisteredWhatsappRequestSent,
} from "@/lib/whatsapp-requests";
import { sql } from "@/lib/db";

const ADMIN_EMAIL = "manoloe@gmail.com";
const TOOL_PATH = "/admin/tools/whatsapp";

function nullIfBlank(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

/** Substitute {whatsapp_url} (and {firstName} for direct rendering)
 * in the WhatsApp invite body. {firstName} is only used for the
 * preview/test path; the live send path leaves it intact and lets the
 * email-send salutation flow handle it. */
function applyWhatsappPlaceholders(
  md: string,
  ctx: { whatsappUrl: string },
): string {
  return md.replaceAll("{whatsapp_url}", ctx.whatsappUrl);
}

/* ------------------------------------------------------------------ */
/* Visiting tab — passthrough to the existing helper.                 */
/* ------------------------------------------------------------------ */

export async function toggleVisitingContactedAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const contacted = formData.get("contacted") === "1";
  if (!Number.isFinite(id) || id <= 0) return;
  await setVisitingRequestContacted(id, contacted);
  revalidatePath(TOOL_PATH);
}

/* ------------------------------------------------------------------ */
/* Registered-alum requests tab                                       */
/* ------------------------------------------------------------------ */

/** Send the WhatsApp invite email to the matched alum and stamp
 * sent_at. Renders the saved template with {whatsapp_url} substituted
 * and Hi {firstName}, auto-prepended. */
export async function sendWhatsappInviteAction(formData: FormData): Promise<void> {
  const requestId = Number(formData.get("request_id"));
  if (!Number.isFinite(requestId) || requestId <= 0) {
    redirect(`${TOOL_PATH}?tab=requests&msg=${encodeURIComponent("Invalid request id")}`);
  }

  const rows = (await sql`
    SELECT r.id, r.alumni_id, a.first_name, a.email
    FROM registered_whatsapp_requests r
    LEFT JOIN alumni a ON a.id = r.alumni_id
    WHERE r.id = ${requestId}
    LIMIT 1
  `) as { id: number; alumni_id: number | null; first_name: string | null; email: string | null }[];

  const row = rows[0];
  if (!row || !row.alumni_id || !row.email) {
    redirect(
      `${TOOL_PATH}?tab=requests&msg=${encodeURIComponent("Cannot send: no matched alumnus.")}`,
    );
  }

  const settings = await getSiteSettings();
  const subject =
    (settings.whatsapp_invite_subject ?? "").trim() || DEFAULT_WHATSAPP_INVITE.subject;
  const bodyMd =
    (settings.whatsapp_invite_body_md ?? "").trim() || DEFAULT_WHATSAPP_INVITE.bodyMd;
  const whatsappUrl = (settings.whatsapp_url ?? "").trim();
  const resolvedMd = ensureParagraphBreaks(
    applyWhatsappPlaceholders(bodyMd, { whatsappUrl }),
  );
  const bodyHtml = renderSimpleMarkdown(resolvedMd, EMAIL_LINK_ATTRS, EMAIL_PARAGRAPH_ATTRS);

  const result = await sendTestEmail({
    to: row.email!,
    subject,
    bodyHtml,
    textFallback: resolvedMd,
    salutation: "Hi",
    includeFirstName: true,
    firstName: row.first_name,
  });
  if (!result.ok) {
    redirect(
      `${TOOL_PATH}?tab=requests&msg=${encodeURIComponent(`Send failed: ${result.error}`)}`,
    );
  }
  await markRegisteredWhatsappRequestSent(requestId);
  revalidatePath(TOOL_PATH);
  redirect(`${TOOL_PATH}?tab=requests&msg=${encodeURIComponent("Invite sent.")}`);
}

/** Reset sent_at — useful when admin needs to resend. */
export async function unmarkWhatsappInviteSentAction(formData: FormData): Promise<void> {
  const requestId = Number(formData.get("request_id"));
  if (!Number.isFinite(requestId) || requestId <= 0) return;
  await clearRegisteredWhatsappRequestSent(requestId);
  revalidatePath(TOOL_PATH);
}

/* ------------------------------------------------------------------ */
/* Template tab                                                       */
/* ------------------------------------------------------------------ */

export async function saveWhatsappTemplateAction(formData: FormData): Promise<void> {
  await updateSiteSettings({
    whatsapp_invite_subject: nullIfBlank(formData.get("subject")),
    whatsapp_invite_body_md: nullIfBlank(formData.get("body_md")),
  });
  revalidatePath(TOOL_PATH);
  redirect(`${TOOL_PATH}?tab=template&saved=1`);
}

export async function sendTestWhatsappTemplateAction(formData: FormData): Promise<void> {
  const subject = nullIfBlank(formData.get("subject")) ?? DEFAULT_WHATSAPP_INVITE.subject;
  const bodyMd = nullIfBlank(formData.get("body_md")) ?? DEFAULT_WHATSAPP_INVITE.bodyMd;
  const settings = await getSiteSettings();
  const whatsappUrl = (settings.whatsapp_url ?? "").trim();
  const resolvedMd = ensureParagraphBreaks(
    applyWhatsappPlaceholders(bodyMd, { whatsappUrl }),
  );
  const bodyHtml = renderSimpleMarkdown(resolvedMd, EMAIL_LINK_ATTRS, EMAIL_PARAGRAPH_ATTRS);

  const result = await sendTestEmail({
    to: ADMIN_EMAIL,
    subject: `[TEST] ${subject}`,
    bodyHtml,
    textFallback: resolvedMd,
    salutation: "Hi",
    includeFirstName: true,
    firstName: "Manolo",
  });
  const flag = result.ok
    ? "test=sent"
    : `test=failed&msg=${encodeURIComponent(result.error)}`;
  redirect(`${TOOL_PATH}?tab=template&${flag}`);
}
