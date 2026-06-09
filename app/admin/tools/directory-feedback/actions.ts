"use server";

import { revalidatePath } from "next/cache";
import { setDirectoryFeedbackStatus } from "@/lib/directory-feedback";

export async function markFeedbackReadAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await setDirectoryFeedbackStatus(id, "read");
  revalidatePath("/admin/tools/directory-feedback");
  revalidatePath("/admin/tools");
}

export async function dismissFeedbackAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await setDirectoryFeedbackStatus(id, "dismissed");
  revalidatePath("/admin/tools/directory-feedback");
  revalidatePath("/admin/tools");
}
