"use server";

import { revalidatePath } from "next/cache";
import {
  setVolunteerSignupContacted,
  setVolunteerSignupAlumni,
} from "@/lib/volunteer-signups";

export async function toggleContactedAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const contacted = formData.get("contacted") === "1";
  if (!Number.isFinite(id) || id <= 0) return;
  await setVolunteerSignupContacted(id, contacted);
  revalidatePath("/admin/help-out");
}

export async function linkAlumniAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const alumniIdRaw = String(formData.get("alumni_id") ?? "");
  if (!Number.isFinite(id) || id <= 0) return;
  const alumniId =
    alumniIdRaw === "" || alumniIdRaw === "0" ? null : Number(alumniIdRaw);
  if (alumniId !== null && (!Number.isFinite(alumniId) || alumniId <= 0)) return;
  await setVolunteerSignupAlumni(id, alumniId);
  revalidatePath("/admin/help-out");
}
