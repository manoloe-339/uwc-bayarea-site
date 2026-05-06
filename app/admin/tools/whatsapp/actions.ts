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
  createRegisteredWhatsappRequest,
  findPendingRequestForAlumni,
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

type AlumInvitePayload = {
  alumni_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  raw_name: string;
};

/** Render the saved template, send to the alum, and fire the admin
 * notification. Shared by the request-driven and admin-initiated send
 * paths so the email + log + notification stay identical. */
async function sendWhatsappInviteToAlum(
  alum: AlumInvitePayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
    [alum.first_name, alum.last_name].filter(Boolean).join(" ") || alum.raw_name;
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
    if (!r.ok) console.warn(`[whatsapp-invite] admin notification failed: ${r.error}`);
  });
  return { ok: true };
}

/** Send the WhatsApp invite email to the matched alum and stamp
 * sent_at. Renders the saved template with {whatsapp_url} substituted
 * and Hi {firstName}, auto-prepended. */
export async function sendWhatsappInviteAction(formData: FormData): Promise<void> {
  const requestId = Number(formData.get("request_id"));
  if (!Number.isFinite(requestId) || requestId <= 0) {
    redirect(`${TOOL_PATH}?tab=requests&msg=${encodeURIComponent("Invalid request id")}`);
  }

  const rows = (await sql`
    SELECT r.id, r.alumni_id, r.raw_name,
           a.first_name, a.last_name, a.email,
           a.uwc_college, a.grad_year
    FROM registered_whatsapp_requests r
    LEFT JOIN alumni a ON a.id = r.alumni_id
    WHERE r.id = ${requestId}
    LIMIT 1
  `) as {
    id: number;
    alumni_id: number | null;
    raw_name: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    uwc_college: string | null;
    grad_year: number | null;
  }[];

  const row = rows[0];
  if (!row || !row.alumni_id || !row.email) {
    redirect(
      `${TOOL_PATH}?tab=requests&msg=${encodeURIComponent("Cannot send: no matched alumnus.")}`,
    );
  }

  const result = await sendWhatsappInviteToAlum({
    alumni_id: row.alumni_id!,
    email: row.email!,
    first_name: row.first_name,
    last_name: row.last_name,
    uwc_college: row.uwc_college,
    grad_year: row.grad_year,
    raw_name: row.raw_name,
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

/** Admin-initiated send: pick any registered alum, create-or-reuse a
 * pending request row for them, fire the invite, mark sent. Result
 * appears in the same Registered list as a regular request. */
export async function initiateWhatsappInviteAction(formData: FormData): Promise<void> {
  const alumniId = Number(formData.get("alumni_id"));
  if (!Number.isFinite(alumniId) || alumniId <= 0) {
    redirect(
      `${TOOL_PATH}?tab=requests&msg=${encodeURIComponent("Pick an alumnus first.")}`,
    );
  }

  const rows = (await sql`
    SELECT id, first_name, last_name, email, uwc_college, grad_year
    FROM alumni
    WHERE id = ${alumniId} AND deceased IS NOT TRUE
    LIMIT 1
  `) as {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    uwc_college: string | null;
    grad_year: number | null;
  }[];
  const alum = rows[0];
  if (!alum) {
    redirect(
      `${TOOL_PATH}?tab=requests&msg=${encodeURIComponent("Alumnus not found.")}`,
    );
  }
  if (!alum.email) {
    redirect(
      `${TOOL_PATH}?tab=requests&msg=${encodeURIComponent("That alumnus has no email on file.")}`,
    );
  }

  const rawName =
    [alum.first_name, alum.last_name].filter(Boolean).join(" ").trim() ||
    `Alumnus #${alum.id}`;

  // Reuse an existing pending row for this alum so we don't create a
  // duplicate next to a homepage-modal request that's still open.
  const pending = await findPendingRequestForAlumni(alum.id);
  const request = pending ?? (await createRegisteredWhatsappRequest({
    alumni_id: alum.id,
    raw_name: rawName,
  }));

  const result = await sendWhatsappInviteToAlum({
    alumni_id: alum.id,
    email: alum.email!,
    first_name: alum.first_name,
    last_name: alum.last_name,
    uwc_college: alum.uwc_college,
    grad_year: alum.grad_year,
    raw_name: rawName,
  });
  if (!result.ok) {
    redirect(
      `${TOOL_PATH}?tab=requests&msg=${encodeURIComponent(`Send failed: ${result.error}`)}`,
    );
  }
  await markRegisteredWhatsappRequestSent(request.id);
  revalidatePath(TOOL_PATH);
  redirect(
    `${TOOL_PATH}?tab=requests&msg=${encodeURIComponent(`Invite sent to ${rawName}.`)}`,
  );
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
