"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateSiteSettings } from "@/lib/settings";

function clampInt(v: FormDataEntryValue | null, min: number, max: number, fallback: number): number {
  const n = v == null ? NaN : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function bool(v: FormDataEntryValue | null): boolean {
  return v != null && String(v) !== "" && String(v) !== "0" && String(v) !== "false";
}

/** Preserves empty string as "" (a deliberate blank). null only when field was missing entirely. */
function sAllowEmpty(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  return String(v).trim();
}

export async function savePhotoGallerySettings(formData: FormData): Promise<void> {
  await updateSiteSettings({
    photo_gallery_thumbs_per_row: clampInt(formData.get("thumbs_per_row"), 3, 5, 4),
    photo_gallery_marquee_paused: bool(formData.get("marquee_paused")),
    photo_gallery_show_intro: bool(formData.get("show_intro")),
    photo_gallery_slide_duration_sec: clampInt(formData.get("slide_duration_sec"), 2, 60, 5),
    photo_gallery_marquee_speed_sec: clampInt(formData.get("marquee_speed_sec"), 20, 200, 70),
    photo_gallery_intro_eyebrow: sAllowEmpty(formData.get("intro_eyebrow")),
    photo_gallery_intro_headline: sAllowEmpty(formData.get("intro_headline")),
    photo_gallery_intro_headline_accent: sAllowEmpty(formData.get("intro_headline_accent")),
    photo_gallery_intro_subhead: sAllowEmpty(formData.get("intro_subhead")),
  });
  revalidatePath("/admin/tools/photo-gallery-settings");
  revalidatePath("/photos");
  redirect("/admin/tools/photo-gallery-settings?saved=1");
}
