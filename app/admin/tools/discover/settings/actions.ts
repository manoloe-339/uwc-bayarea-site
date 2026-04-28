"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { updateSiteSettings } from "@/lib/settings";

function bumpRevalidation(): void {
  revalidatePath("/admin/tools/discover");
  revalidatePath("/admin/tools/discover/settings");
}

/* ---------- LinkedIn invite template ---------- */

export async function saveInviteTemplate(formData: FormData): Promise<void> {
  const raw = String(formData.get("linkedin_invite_template") ?? "").trim();
  await updateSiteSettings({
    linkedin_invite_template: raw.length > 0 ? raw : null,
  });
  bumpRevalidation();
}

/* ---------- Search queries ---------- */

export async function addQuery(formData: FormData): Promise<void> {
  const query = String(formData.get("query") ?? "").trim();
  const group = String(formData.get("group_label") ?? "").trim() || "custom";
  if (!query) return;
  const next = (await sql`
    SELECT COALESCE(MAX(sort_order), 0) + 10 AS n FROM discovery_query_templates
  `) as { n: number }[];
  const sortOrder = next[0]?.n ?? 10;
  await sql`
    INSERT INTO discovery_query_templates (query, group_label, sort_order)
    VALUES (${query}, ${group}, ${sortOrder})
    ON CONFLICT (query) DO NOTHING
  `;
  bumpRevalidation();
}

export async function updateQuery(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const query = String(formData.get("query") ?? "").trim();
  const group = String(formData.get("group_label") ?? "").trim();
  if (!Number.isFinite(id) || id <= 0) return;
  if (!query) return;
  await sql`
    UPDATE discovery_query_templates
    SET query = ${query}, group_label = ${group}, updated_at = NOW()
    WHERE id = ${id}
  `;
  bumpRevalidation();
}

export async function toggleQuery(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await sql`
    UPDATE discovery_query_templates
    SET enabled = NOT enabled, updated_at = NOW()
    WHERE id = ${id}
  `;
  bumpRevalidation();
}

export async function deleteQuery(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await sql`DELETE FROM discovery_query_templates WHERE id = ${id}`;
  bumpRevalidation();
}

/* ---------- Excluded terms ---------- */

export async function addTerm(formData: FormData): Promise<void> {
  const term = String(formData.get("term") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!term) return;
  await sql`
    INSERT INTO discovery_excluded_terms (term, note)
    VALUES (${term}, ${note})
    ON CONFLICT (term) DO NOTHING
  `;
  bumpRevalidation();
}

export async function deleteTerm(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await sql`DELETE FROM discovery_excluded_terms WHERE id = ${id}`;
  bumpRevalidation();
}
