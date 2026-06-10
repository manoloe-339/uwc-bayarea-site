"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { sql } from "@/lib/db";
import { COLLEGES } from "@/lib/uwc-colleges";

export type UwcSlot = "logo" | "campus" | "other";

function isValidCanonical(c: string): boolean {
  return COLLEGES.some((x) => x.canonical === c);
}

/** Upload (or replace) one of the three asset slots for a UWC. */
export async function uploadUwcAsset(formData: FormData): Promise<void> {
  const canonical = String(formData.get("canonical") ?? "");
  const slot = String(formData.get("slot") ?? "") as UwcSlot;
  const file = formData.get("file") as File | null;
  if (!isValidCanonical(canonical)) throw new Error("invalid canonical");
  if (slot !== "logo" && slot !== "campus" && slot !== "other") {
    throw new Error("invalid slot");
  }
  if (!file || file.size === 0) throw new Error("no file");

  const slug = canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "jpg").toLowerCase();
  const hash = crypto.randomBytes(6).toString("hex");
  const key = `uwc/${slug}/${slot}-${hash}.${ext}`;
  const uploaded = await put(key, file, {
    access: "public",
    allowOverwrite: true,
  });

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
