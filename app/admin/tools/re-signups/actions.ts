"use server";

import { revalidatePath } from "next/cache";
import { setSubmissionStatus } from "@/lib/signup-submissions";

export async function markSubmissionReadAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await setSubmissionStatus(id, "read");
  revalidatePath("/admin/tools/re-signups");
  revalidatePath("/admin/tools");
}

export async function dismissSubmissionAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await setSubmissionStatus(id, "dismissed");
  revalidatePath("/admin/tools/re-signups");
  revalidatePath("/admin/tools");
}
