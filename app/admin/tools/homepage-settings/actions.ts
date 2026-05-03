"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  setHeroSlideEnabled,
  isHeroFocalPoint,
  parseExtraImageSettings,
  type HeroFocalPoint,
  type ExtraImageSetting,
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

function readFocalPoint(v: FormDataEntryValue | null): HeroFocalPoint {
  const s = String(v ?? "").trim();
  return isHeroFocalPoint(s) ? s : "center";
}

function readZoom(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "1").trim());
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.5, Math.min(2, n));
}

function readExtras(v: FormDataEntryValue | null): ExtraImageSetting[] {
  const raw = String(v ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return parseExtraImageSettings(parsed);
  } catch {
    return [];
  }
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
    focal_point: readFocalPoint(formData.get("focal_point")),
    zoom: readZoom(formData.get("zoom")),
    mobile_focal_point: readFocalPoint(formData.get("mobile_focal_point")),
    mobile_zoom: readZoom(formData.get("mobile_zoom")),
    extra_image_settings: readExtras(formData.get("extra_image_settings")),
    sort_order: intOr(formData.get("sort_order"), 0),
    enabled: formData.get("enabled") != null,
  };
}

export async function createHeroSlideAction(formData: FormData): Promise<void> {
  const data = readSlideForm(formData);
  await createHeroSlide(data);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/");
  redirect("/admin/tools/homepage-settings?saved=1");
}

export async function updateHeroSlideAction(
  id: number,
  formData: FormData
): Promise<void> {
  const data = readSlideForm(formData);
  await updateHeroSlide(id, data);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/");
  redirect("/admin/tools/homepage-settings?saved=1");
}

export async function deleteHeroSlideAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await deleteHeroSlide(id);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/");
}

export async function toggleHeroSlideEnabledAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const enabled = formData.get("enabled") === "1";
  if (!Number.isFinite(id) || id <= 0) return;
  await setHeroSlideEnabled(id, enabled);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/");
}
