"use server";

import { revalidatePath } from "next/cache";
import { classifyAll, listCompaniesWithClassifications, upsertClassification } from "@/lib/company-classifications";
import { classifyCompany, CLASSIFIER_MODEL } from "@/lib/company-classifier";

export async function runClassifierAction(formData: FormData): Promise<void> {
  const scope = String(formData.get("scope") ?? "unclassified");
  const onlyUnclassified = scope !== "all";
  await classifyAll({
    onlyUnclassified,
    concurrency: 5,
  });
  revalidatePath("/admin/tools/classify");
  revalidatePath("/admin/alumni");
}

export async function classifyOneAction(companyKey: string): Promise<void> {
  const companies = await listCompaniesWithClassifications();
  const c = companies.find((x) => x.company_key === companyKey);
  if (!c) throw new Error("Company not found");
  const res = await classifyCompany({
    name: c.company_name,
    industry: c.industry,
    size: c.size,
    website: c.website,
    linkedinUrl: c.linkedin_url,
  });
  if (!res.ok) throw new Error(res.error);
  await upsertClassification({
    companyKey: c.company_key,
    companyName: c.company_name,
    ...res.data,
    model: CLASSIFIER_MODEL,
  });
  revalidatePath("/admin/tools/classify");
  revalidatePath("/admin/alumni");
}
