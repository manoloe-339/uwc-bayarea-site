"use server";

import { revalidatePath } from "next/cache";
import { setVisitingRequestContacted } from "@/lib/visiting-requests";

export async function toggleContactedAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const contacted = formData.get("contacted") === "1";
  if (!Number.isFinite(id) || id <= 0) return;
  await setVisitingRequestContacted(id, contacted);
  revalidatePath("/admin/tools/visiting");
}
