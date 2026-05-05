"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateSiteSettings, DEFAULT_SIGNUP_CONFIRMATION } from "@/lib/settings";
import {
  applyConfirmationPlaceholders,
  fetchCollegeAlumniCount,
} from "@/lib/signup-confirmation";
import { sendTestEmail } from "@/lib/email-send";
import { renderSimpleMarkdown, EMAIL_LINK_ATTRS } from "@/lib/simple-markdown";

const ADMIN_EMAIL = "manoloe@gmail.com";
const PREVIEW_COLLEGE = "UWC Atlantic College";

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
  const previewCount = await fetchCollegeAlumniCount(PREVIEW_COLLEGE).catch(() => 0);
  const resolvedMd = applyConfirmationPlaceholders(bodyMd, {
    college: PREVIEW_COLLEGE,
    collegeCount: previewCount,
  });
  const bodyHtml = renderSimpleMarkdown(resolvedMd, EMAIL_LINK_ATTRS);

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
