"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateSiteSettings } from "@/lib/settings";

function nullIfBlank(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

export async function saveSignupThanksAction(formData: FormData): Promise<void> {
  await updateSiteSettings({
    signup_thanks_eyebrow: nullIfBlank(formData.get("eyebrow")),
    signup_thanks_headline: nullIfBlank(formData.get("headline")),
    signup_thanks_body_md: nullIfBlank(formData.get("body_md")),
    signup_thanks_button_label: nullIfBlank(formData.get("button_label")),
  });
  revalidatePath("/admin/tools/signup-thanks");
  revalidatePath("/signup/thanks");
  redirect("/admin/tools/signup-thanks?saved=1");
}
