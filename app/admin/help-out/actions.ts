"use server";

import { revalidatePath } from "next/cache";
import { setVolunteerSignupContacted } from "@/lib/volunteer-signups";

export async function toggleContactedAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const contacted = formData.get("contacted") === "1";
  if (!Number.isFinite(id) || id <= 0) return;
  await setVolunteerSignupContacted(id, contacted);
  revalidatePath("/admin/help-out");
}
