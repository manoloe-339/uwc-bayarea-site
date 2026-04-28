"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateSiteSettings } from "@/lib/settings";

function s(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

export async function saveSiteSettings(formData: FormData): Promise<void> {
  await updateSiteSettings({
    logo_url: s(formData.get("logo_url")),
    footer_tagline: s(formData.get("footer_tagline")),
    physical_address: s(formData.get("physical_address")),
    whatsapp_url: s(formData.get("whatsapp_url")),
    whatsapp_default_headline: s(formData.get("whatsapp_default_headline")),
    whatsapp_default_body: s(formData.get("whatsapp_default_body")),
    whatsapp_default_cta_label: s(formData.get("whatsapp_default_cta_label")),
    foodies_default_headline: s(formData.get("foodies_default_headline")),
    foodies_default_body: s(formData.get("foodies_default_body")),
    foodies_default_cta_label: s(formData.get("foodies_default_cta_label")),
    foodies_default_cta_url: s(formData.get("foodies_default_cta_url")),
    default_from_name: s(formData.get("default_from_name")),
  });
  revalidatePath("/admin/email/settings");
  revalidatePath("/admin/email/preview");
  redirect("/admin/email/settings?saved=1");
}
