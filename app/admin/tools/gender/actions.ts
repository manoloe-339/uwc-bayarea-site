"use server";

import { revalidatePath } from "next/cache";
import { classifyAllGenders } from "@/lib/gender-classifications";
import { classifyGender, GENDER_CLASSIFIER_MODEL } from "@/lib/gender-classifier";
import { sql } from "@/lib/db";

export async function runGenderClassifierAction(formData: FormData): Promise<void> {
  const scope = String(formData.get("scope") ?? "unclassified");
  const onlyUnclassified = scope !== "all";
  await classifyAllGenders({ onlyUnclassified, concurrency: 5 });
  revalidatePath("/admin/tools/gender");
  revalidatePath("/admin/alumni");
}

export async function classifyOneGenderAction(alumniId: number): Promise<void> {
  const rows = (await sql`
    SELECT first_name, last_name, origin, headline, linkedin_about FROM alumni WHERE id = ${alumniId}
  `) as { first_name: string | null; last_name: string | null; origin: string | null; headline: string | null; linkedin_about: string | null }[];
  const a = rows[0];
  if (!a) throw new Error("Not found");
  if (!a.first_name) throw new Error("No first name to classify");
  const res = await classifyGender({
    firstName: a.first_name,
    lastName: a.last_name,
    origin: a.origin,
    headline: a.headline,
    linkedinAbout: a.linkedin_about,
  });
  if (!res.ok) throw new Error(res.error);
  await sql`
    UPDATE alumni SET gender = ${res.data.gender}, gender_confidence = ${res.data.confidence}, gender_source = 'llm'
    WHERE id = ${alumniId}
  `;
  revalidatePath("/admin/tools/gender");
  revalidatePath("/admin/alumni");
}

export async function setGenderManualAction(alumniId: number, formData: FormData): Promise<void> {
  const raw = String(formData.get("gender") ?? "");
  const allowed = new Set(["male", "female", "they", "unknown", ""]);
  if (!allowed.has(raw)) throw new Error("Invalid gender");
  const value = raw === "" ? null : raw;
  await sql`
    UPDATE alumni SET
      gender = ${value},
      gender_confidence = ${value == null ? null : 1.0},
      gender_source = 'admin',
      updated_at = NOW()
    WHERE id = ${alumniId}
  `;
  revalidatePath("/admin/tools/gender");
  revalidatePath("/admin/alumni");
  revalidatePath(`/admin/alumni/${alumniId}`);
}

export { GENDER_CLASSIFIER_MODEL };
