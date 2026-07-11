"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateSiteSettings, DEFAULT_SIGNUP_CONFIRMATION } from "@/lib/settings";
import {
  applyConfirmationPlaceholders,
  ensureParagraphBreaks,
  fetchCollegeAlumniCount,
  fetchCompanyAlumniCount,
} from "@/lib/signup-confirmation";
import { sendTestEmail } from "@/lib/email-send";
import {
  renderSimpleMarkdown,
  EMAIL_LINK_ATTRS,
  EMAIL_PARAGRAPH_ATTRS,
} from "@/lib/simple-markdown";
import { signWhatsappInviteToken } from "@/lib/whatsapp-invite-token";
import { sql } from "@/lib/db";

const ADMIN_EMAIL = "manoloe@gmail.com";
const PREVIEW_COLLEGE = "UWC Atlantic College";

/** Sign a real {whatsapp_link} for the admin's own alumni row when
 *  available, so the test email lands on a working trusted-token
 *  page instead of the generic /join-whatsapp. Falls back to the
 *  no-token URL when there's no matching alum or signing fails. */
async function buildAdminWhatsappLink(): Promise<string> {
  const fallback = "https://uwcbayarea.org/join-whatsapp";
  try {
    const rows = (await sql`
      SELECT id FROM alumni WHERE email = ${ADMIN_EMAIL} LIMIT 1
    `) as Array<{ id: number }>;
    const id = rows[0]?.id;
    if (!id) return fallback;
    const token = await signWhatsappInviteToken(id);
    return `https://uwcbayarea.org/join-whatsapp?invite=${encodeURIComponent(token)}`;
  } catch {
    return fallback;
  }
}

/** Save a deliberate blank as null (so the action falls back to the
 * default copy on the next signup). Trim only — don't strip empty lines
 * inside the body. */
function nullIfBlank(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

export async function saveSignupEmailAction(formData: FormData): Promise<void> {
  await updateSiteSettings({
    signup_confirmation_subject: nullIfBlank(formData.get("subject")),
    signup_confirmation_body_md: nullIfBlank(formData.get("body_md")),
  });
  revalidatePath("/admin/tools/signup-email");
  redirect("/admin/tools/signup-email?saved=1");
}

/** Send a preview to the admin so they can see the rendered HTML in
 * their actual mail client before exposing it to new signups. */
export async function sendTestSignupEmailAction(formData: FormData): Promise<void> {
  const subject =
    nullIfBlank(formData.get("subject")) ?? DEFAULT_SIGNUP_CONFIRMATION.subject;
  const bodyMd =
    nullIfBlank(formData.get("body_md")) ?? DEFAULT_SIGNUP_CONFIRMATION.bodyMd;
  const [previewCount, whatsappLink, adminSelf] = await Promise.all([
    fetchCollegeAlumniCount(PREVIEW_COLLEGE).catch(() => 0),
    buildAdminWhatsappLink(),
    (async () => {
      try {
        const rows = (await sql`
          SELECT id, current_company, current_company_linkedin
          FROM alumni WHERE email = ${ADMIN_EMAIL} LIMIT 1
        `) as Array<{
          id: number;
          current_company: string | null;
          current_company_linkedin: string | null;
        }>;
        return rows[0] ?? null;
      } catch {
        return null;
      }
    })(),
  ]);
  const previewCompanyCount = adminSelf
    ? await fetchCompanyAlumniCount(
        adminSelf.current_company_linkedin,
        adminSelf.current_company,
        adminSelf.id,
      ).catch(() => 0)
    : 0;
  const resolvedMd = ensureParagraphBreaks(
    applyConfirmationPlaceholders(bodyMd, {
      college: PREVIEW_COLLEGE,
      collegeCount: previewCount,
      // Preview against the admin's own real current_company so the
      // test email matches what a signup would see and doesn't invent
      // an unrelated employer. Falls back to a "{Your company}"
      // marker when the admin row can't be read.
      company: adminSelf?.current_company ?? "{Your company}",
      companyCount: previewCompanyCount,
      whatsappLink,
    }),
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

  const flag = result.ok ? "test=sent" : `test=failed&msg=${encodeURIComponent(result.error)}`;
  redirect(`/admin/tools/signup-email?${flag}`);
}
