"use server";

import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import crypto from "node:crypto";
import { sql } from "@/lib/db";

export type AssetKind = "university_logo" | "company_logo" | "flag";

const VALID_KINDS: AssetKind[] = ["university_logo", "company_logo", "flag"];

function isValidKind(k: string): k is AssetKind {
  return (VALID_KINDS as string[]).includes(k);
}

export async function createLoginAsset(formData: FormData): Promise<void> {
  const kind = String(formData.get("kind") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!isValidKind(kind)) throw new Error("invalid kind");
  if (!label) throw new Error("label required");
  if (!file || file.size === 0) throw new Error("no file");

  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "asset";
  const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "jpg").toLowerCase();
  const hash = crypto.randomBytes(6).toString("hex");
  const key = `login-library/${kind}/${slug}-${hash}.${ext}`;

  const uploaded = await put(key, file, {
    access: "public",
    allowOverwrite: true,
  });

  await sql`
    INSERT INTO login_assets (kind, label, image_url)
    VALUES (${kind}, ${label}, ${uploaded.url})
  `;
  revalidatePath("/admin/tools/login-assets");
}

export async function deleteLoginAsset(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("bad id");
  const rows = (await sql`
    SELECT image_url FROM login_assets WHERE id = ${id}
  `) as Array<{ image_url: string }>;
  const url = rows[0]?.image_url;
  await sql`DELETE FROM login_assets WHERE id = ${id}`;
  // Best-effort blob cleanup. Failure is fine — the row is gone and
  // the blob will sit unreferenced.
  if (url) {
    try {
      await del(url);
    } catch {
      // ignore
    }
  }
  revalidatePath("/admin/tools/login-assets");
}
