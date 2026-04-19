"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendTestEmail, sendCampaign } from "@/lib/email-send";
import { acquireSendLock, releaseSendLock } from "@/lib/send-lock";
import type { AlumniFilters } from "@/lib/alumni-query";

export type SendTestResult = { ok: boolean; error?: string; id?: string };

export async function sendTest(
  _prev: SendTestResult | null,
  formData: FormData
): Promise<SendTestResult> {
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const salutation = String(formData.get("salutation") ?? "").trim();
  const includeFirstName = formData.get("includeFirstName") === "1";
  if (!to || !subject || !body) return { ok: false, error: "Missing to/subject/body" };
  const result = await sendTestEmail({ to, subject, body, salutation, includeFirstName });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: result.id };
}

export async function sendToAll(formData: FormData): Promise<void> {
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const salutation = String(formData.get("salutation") ?? "").trim();
  const includeFirstName = formData.get("includeFirstName") === "1";
  const filtersJson = String(formData.get("filters") ?? "{}");
  if (!subject || !body) {
    throw new Error("Subject and body are required");
  }

  let filters: AlumniFilters = {};
  try {
    filters = JSON.parse(filtersJson) as AlumniFilters;
  } catch {
    filters = {};
  }

  const locked = await acquireSendLock();
  if (!locked) {
    throw new Error("Another send is already in progress — try again in a minute.");
  }

  let campaignId: string | null = null;
  try {
    const result = await sendCampaign({ filters, subject, body, salutation, includeFirstName, createdBy: "admin" });
    campaignId = result.campaignId;
  } finally {
    await releaseSendLock();
  }

  revalidatePath("/admin/email");
  if (campaignId) redirect(`/admin/email/${campaignId}`);
}
