"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createNewsFeature,
  updateNewsFeature,
  deleteNewsFeature,
  setNewsFeatureEnabled,
} from "@/lib/news-features";

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

function readNewsForm(formData: FormData) {
  return {
    alumni_id: maybeId(formData.get("alumni_id")),
    publication: txt(formData.get("publication")),
    date_label: txt(formData.get("date_label")),
    pull_quote: reqText(formData.get("pull_quote"), "Pull quote"),
    article_url: txt(formData.get("article_url")),
    portrait_override_url: txt(formData.get("portrait_override_url")),
    sort_order: intOr(formData.get("sort_order"), 0),
    enabled: formData.get("enabled") != null,
  };
}

export async function createNewsFeatureAction(formData: FormData): Promise<void> {
  await createNewsFeature(readNewsForm(formData));
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/preview-home");
  redirect("/admin/tools/homepage-settings?saved=1");
}

export async function updateNewsFeatureAction(
  id: number,
  formData: FormData
): Promise<void> {
  await updateNewsFeature(id, readNewsForm(formData));
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/preview-home");
  redirect("/admin/tools/homepage-settings?saved=1");
}

export async function deleteNewsFeatureAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await deleteNewsFeature(id);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/preview-home");
}

export async function toggleNewsFeatureEnabledAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const enabled = formData.get("enabled") === "1";
  if (!Number.isFinite(id) || id <= 0) return;
  await setNewsFeatureEnabled(id, enabled);
  revalidatePath("/admin/tools/homepage-settings");
  revalidatePath("/preview-home");
}
