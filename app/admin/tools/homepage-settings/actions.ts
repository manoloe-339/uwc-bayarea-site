"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  setHeroSlideEnabled,
} from "@/lib/hero-slides";

function txt(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function reqText(v: FormDataEntryValue | null, label: string): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${label} is required`);
  return s;
}

function intOr(v: FormDataEntryValue | null, fallback: number): number {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function maybeId(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readSlideForm(formData: FormData) {
  return {
    event_id: maybeId(formData.get("event_id")),
    eyebrow: txt(formData.get("eyebrow")),
    title: reqText(formData.get("title"), "Title"),
    emphasis: txt(formData.get("emphasis")),
    byline: txt(formData.get("byline")),
    cta_label: txt(formData.get("cta_label")),
    cta_href: txt(formData.get("cta_href")),
    image_url: txt(formData.get("image_url")),
    sort_order: intOr(formData.get("sort_order"), 0),
    enabled: formData.get("enabled") != null,
  };
}

export async function createHeroSlideAction(formData: FormData): Promise<void> {
  const data = readSlideForm(formData);
  await createHeroSlide(data);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/preview-home");
  redirect("/admin/tools/homepage-settings?saved=1");
}

export async function updateHeroSlideAction(
  id: number,
  formData: FormData
): Promise<void> {
  const data = readSlideForm(formData);
  await updateHeroSlide(id, data);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/preview-home");
  redirect("/admin/tools/homepage-settings?saved=1");
}

export async function deleteHeroSlideAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await deleteHeroSlide(id);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/preview-home");
}

export async function toggleHeroSlideEnabledAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const enabled = formData.get("enabled") === "1";
  if (!Number.isFinite(id) || id <= 0) return;
  await setHeroSlideEnabled(id, enabled);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/preview-home");
}
