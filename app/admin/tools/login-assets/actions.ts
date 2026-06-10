"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put, del } from "@vercel/blob";
import crypto from "node:crypto";
import { sql } from "@/lib/db";

export type AssetKind = "university_logo" | "company_logo" | "flag";

const VALID_KINDS: AssetKind[] = ["university_logo", "company_logo", "flag"];
const PAGE = "/admin/tools/login-assets";

function isValidKind(k: string): k is AssetKind {
  return (VALID_KINDS as string[]).includes(k);
}

function failTo(message: string): never {
  redirect(`${PAGE}?error=${encodeURIComponent(message)}`);
}

/** Resolve image bytes from either a form-uploaded file or a URL.
 * URL is fetched server-side. File wins when both are provided. */
async function loadImageInput(
  file: File | null,
  url: string,
): Promise<{ data: Blob; ext: string }> {
  if (file && file.size > 0) {
    const ext = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? "jpg";
    return { data: file, ext };
  }
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Provide either a file or a URL.");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("URL must start with http:// or https://");
  }
  const res = await fetch(trimmed, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status})`);
  const data = await res.blob();
  if (data.size === 0) throw new Error("Remote URL returned an empty body.");
  let ext =
    trimmed.split("?")[0].match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? "";
  if (!ext || ext.length > 5) {
    const mime = res.headers.get("content-type") ?? "";
    if (mime.includes("png")) ext = "png";
    else if (mime.includes("svg")) ext = "svg";
    else if (mime.includes("webp")) ext = "webp";
    else if (mime.includes("gif")) ext = "gif";
    else ext = "jpg";
  }
  return { data, ext };
}

export async function createLoginAsset(formData: FormData): Promise<void> {
  const kind = String(formData.get("kind") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const file = formData.get("file") as File | null;
  const url = String(formData.get("url") ?? "");
  if (!isValidKind(kind)) failTo("Unknown asset kind.");
  if (!label) failTo("Label is required.");

  let payload: { data: Blob; ext: string };
  try {
    payload = await loadImageInput(file, url);
  } catch (err) {
    failTo(err instanceof Error ? err.message : "Couldn't load image.");
  }
  const { data, ext } = payload;
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "asset";
  const hash = crypto.randomBytes(6).toString("hex");
  const key = `login-library/${kind}/${slug}-${hash}.${ext}`;

  let uploaded: { url: string };
  try {
    uploaded = await put(key, data, {
      access: "public",
      allowOverwrite: true,
    });
  } catch (err) {
    failTo(err instanceof Error ? err.message : "Upload to storage failed.");
  }

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
