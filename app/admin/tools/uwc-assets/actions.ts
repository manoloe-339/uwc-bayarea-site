"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { sql } from "@/lib/db";
import { COLLEGES } from "@/lib/uwc-colleges";

export type UwcSlot = "logo" | "campus" | "other";
const PAGE = "/admin/tools/uwc-assets";

function isValidCanonical(c: string): boolean {
  return COLLEGES.some((x) => x.canonical === c);
}

/** Redirect back to the admin page with an `?error=...` query so
 * the user sees a friendly message instead of the framework's
 * "Application error: server-side exception" page. */
function failTo(message: string): never {
  redirect(`${PAGE}?error=${encodeURIComponent(message)}`);
}

/** Pick an image payload from either the form file input or a URL.
 * URL is fetched server-side. Returns the bytes + a safe filename
 * extension. */
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

/** Upload (or replace) one of the three asset slots for a UWC.
 * Accepts either a file (form-upload) or a remote URL (server-side
 * fetched + re-hosted). One or the other — file wins if both are
 * present. Errors redirect back to the page with ?error=...
 * instead of throwing (so the user doesn't hit the framework's
 * generic Application Error screen). */
export async function uploadUwcAsset(formData: FormData): Promise<void> {
  const canonical = String(formData.get("canonical") ?? "");
  const slot = String(formData.get("slot") ?? "") as UwcSlot;
  const file = formData.get("file") as File | null;
  const url = String(formData.get("url") ?? "");
  if (!isValidCanonical(canonical)) failTo("Unknown UWC.");
  if (slot !== "logo" && slot !== "campus" && slot !== "other") {
    failTo("Unknown asset slot.");
  }

  let payload: { data: Blob; ext: string };
  try {
    payload = await loadImageInput(file, url);
  } catch (err) {
    failTo(err instanceof Error ? err.message : "Couldn't load image.");
  }
  const { data, ext } = payload;
  const slug = canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const hash = crypto.randomBytes(6).toString("hex");
  const key = `uwc/${slug}/${slot}-${hash}.${ext}`;
  let uploaded: { url: string };
  try {
    uploaded = await put(key, data, {
      access: "public",
      allowOverwrite: true,
    });
  } catch (err) {
    failTo(err instanceof Error ? err.message : "Upload to storage failed.");
  }

  // Ensure the row exists, then set the right column. Three explicit
  // statements (rather than dynamic column names) keep us on the
  // tagged-template path everyone else in the codebase uses.
  if (slot === "logo") {
    await sql`
      INSERT INTO uwc_assets (canonical, logo_url) VALUES (${canonical}, ${uploaded.url})
      ON CONFLICT (canonical) DO UPDATE
      SET logo_url = EXCLUDED.logo_url, updated_at = NOW()
    `;
  } else if (slot === "campus") {
    await sql`
      INSERT INTO uwc_assets (canonical, campus_url) VALUES (${canonical}, ${uploaded.url})
      ON CONFLICT (canonical) DO UPDATE
      SET campus_url = EXCLUDED.campus_url, updated_at = NOW()
    `;
  } else {
    await sql`
      INSERT INTO uwc_assets (canonical, other_url) VALUES (${canonical}, ${uploaded.url})
      ON CONFLICT (canonical) DO UPDATE
      SET other_url = EXCLUDED.other_url, updated_at = NOW()
    `;
  }
  revalidatePath("/admin/tools/uwc-assets");
}

export async function clearUwcAsset(formData: FormData): Promise<void> {
  const canonical = String(formData.get("canonical") ?? "");
  const slot = String(formData.get("slot") ?? "") as UwcSlot;
  if (!isValidCanonical(canonical)) throw new Error("invalid canonical");
  if (slot === "logo") {
    await sql`UPDATE uwc_assets SET logo_url = NULL, updated_at = NOW() WHERE canonical = ${canonical}`;
  } else if (slot === "campus") {
    await sql`UPDATE uwc_assets SET campus_url = NULL, updated_at = NOW() WHERE canonical = ${canonical}`;
  } else if (slot === "other") {
    await sql`UPDATE uwc_assets SET other_url = NULL, updated_at = NOW() WHERE canonical = ${canonical}`;
  } else {
    throw new Error("invalid slot");
  }
  revalidatePath("/admin/tools/uwc-assets");
}
