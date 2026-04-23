"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

export async function deleteAlumniAction(alumniId: number): Promise<void> {
  // Mirrors the one-off dedupe flow: wipe child rows first, then the alumni
  // row (capturing the photo URL for blob cleanup).
  await sql`DELETE FROM alumni_career WHERE alumni_id = ${alumniId}`;
  await sql`DELETE FROM alumni_education WHERE alumni_id = ${alumniId}`;
  await sql`DELETE FROM alumni_volunteering WHERE alumni_id = ${alumniId}`;
  const deleted = (await sql`
    DELETE FROM alumni WHERE id = ${alumniId} RETURNING id, email, photo_url
  `) as { id: number; email: string | null; photo_url: string | null }[];
  const row = deleted[0];

  // Best-effort blob cleanup so storage doesn't accumulate orphans.
  if (row?.photo_url && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import("@vercel/blob");
      await del(row.photo_url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // ignore — row is already gone, blob cleanup is non-critical
    }
  }
  revalidatePath("/admin/tools/duplicates");
  revalidatePath("/admin/alumni");
}

export async function swapAndDeleteAction(
  keepId: number,
  deleteId: number,
  newEmailForKeeper: string
): Promise<void> {
  const trimmed = newEmailForKeeper.trim();
  if (!trimmed) throw new Error("Missing email");
  // Order matters: delete the dupe first to free its email (unique
  // constraint on alumni.email), then update the keeper.
  await deleteAlumniAction(deleteId);
  await sql`UPDATE alumni SET email = ${trimmed}, updated_at = NOW() WHERE id = ${keepId}`;
  revalidatePath("/admin/tools/duplicates");
  revalidatePath("/admin/alumni");
}
