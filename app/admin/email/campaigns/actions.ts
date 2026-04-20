"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import type { CampaignDraft } from "@/lib/campaign-content";
import { sendCampaignNow, sendCampaignTest, MAX_RECIPIENTS_PER_CAMPAIGN } from "@/lib/campaign-send";
import { countFilteredRecipients, getFilteredRecipients } from "@/lib/recipients";
import type { AlumniFilters } from "@/lib/alumni-query";

type Row = { id: string };

export async function saveDraft(draft: CampaignDraft): Promise<string> {
  const { id, newContent } = splitContent(draft);
  const scheduledFor = draft.sendMode === "scheduled" && draft.scheduledFor
    ? new Date(draft.scheduledFor)
    : null;
  const status = draft.status ?? "draft";

  if (id) {
    await sql`
      UPDATE email_campaigns SET
        format          = ${draft.format},
        subject         = ${draft.subject},
        preheader       = ${draft.preheader || null},
        from_name       = ${draft.fromName || null},
        mode            = ${draft.format === "newsletter" ? draft.newsletter?.mode ?? null : null},
        body            = ${draft.format === "quick_note" ? draft.quickNote?.body ?? "" : ""},
        content_json    = ${JSON.stringify(newContent)}::jsonb,
        filter_snapshot = ${JSON.stringify(draft.filters ?? {})}::jsonb,
        scheduled_for   = ${scheduledFor},
        status          = ${status}
      WHERE id = ${id}
    `;
    revalidatePath(`/admin/email/campaigns/${id}/edit`);
    revalidatePath(`/admin/email/campaigns/${id}`);
    revalidatePath(`/admin/email/campaigns`);
    return id;
  }

  const rows = (await sql`
    INSERT INTO email_campaigns (
      format, subject, preheader, from_name, mode, body,
      content_json, filter_snapshot, scheduled_for, status,
      recipient_count, created_by
    ) VALUES (
      ${draft.format}, ${draft.subject}, ${draft.preheader || null},
      ${draft.fromName || null},
      ${draft.format === "newsletter" ? draft.newsletter?.mode ?? null : null},
      ${draft.format === "quick_note" ? draft.quickNote?.body ?? "" : ""},
      ${JSON.stringify(newContent)}::jsonb,
      ${JSON.stringify(draft.filters ?? {})}::jsonb,
      ${scheduledFor}, 'draft', 0, 'admin'
    )
    RETURNING id
  `) as Row[];
  const newId = rows[0].id;
  revalidatePath(`/admin/email/campaigns`);
  return newId;
}

export async function saveDraftAction(draft: CampaignDraft): Promise<{ id: string }> {
  const id = await saveDraft(draft);
  return { id };
}

export async function deleteCampaign(id: string): Promise<void> {
  const existing = (await sql`SELECT status FROM email_campaigns WHERE id = ${id}`) as {
    status: string | null;
  }[];
  if (existing.length === 0) return;
  if (existing[0].status !== "draft") {
    throw new Error("Only drafts can be deleted. Use 'Cancel' on scheduled campaigns.");
  }
  await sql`DELETE FROM email_campaigns WHERE id = ${id}`;
  revalidatePath("/admin/email/campaigns");
  redirect("/admin/email/campaigns");
}

export async function cancelScheduled(id: string): Promise<void> {
  await sql`
    UPDATE email_campaigns
    SET status = 'cancelled', scheduled_for = NULL
    WHERE id = ${id} AND status = 'scheduled'
  `;
  revalidatePath("/admin/email/campaigns");
  revalidatePath(`/admin/email/campaigns/${id}`);
}

export async function duplicateCampaign(sourceId: string): Promise<string> {
  const rows = (await sql`
    INSERT INTO email_campaigns (
      format, subject, preheader, from_name, mode, body,
      content_json, filter_snapshot, status, duplicated_from_id,
      recipient_count, created_by
    )
    SELECT
      format,
      'Copy of: ' || COALESCE(subject, '(untitled)'),
      preheader, from_name, mode, body,
      content_json, filter_snapshot,
      'draft', id, 0, 'admin'
    FROM email_campaigns WHERE id = ${sourceId}
    RETURNING id
  `) as Row[];
  if (rows.length === 0) throw new Error("Source campaign not found");
  const newId = rows[0].id;
  revalidatePath("/admin/email/campaigns");
  return newId;
}

export async function sendTestAction(input: {
  draft: CampaignDraft;
  toEmail: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!input.toEmail || !input.toEmail.includes("@")) {
    return { ok: false, error: "Enter a valid test email." };
  }
  // Save-then-send — guarantees the renderer reads the current draft.
  const campaignId = await saveDraft(input.draft);

  // Prefer the actual recipient's first name when we can: if the test email
  // matches someone in the filter, use their name; otherwise use the first
  // recipient's name (gives hand-picked sends the right preview); fall back
  // to 'Sarah' when the filter set is empty.
  const { list } = await getFilteredRecipients(input.draft.filters);
  const toLower = input.toEmail.trim().toLowerCase();
  const match = list.find((r) => r.email.toLowerCase() === toLower);
  const firstName = match?.first_name ?? list[0]?.first_name ?? "Sarah";

  const result = await sendCampaignTest({
    campaignId,
    toEmail: input.toEmail,
    firstName,
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/admin/email/campaigns/${campaignId}/edit`);
  return { ok: true, id: result.id };
}

export async function sendNowAction(input: {
  draft: CampaignDraft;
}): Promise<
  { ok: true; recipients: number; sent: number; failed: number; id: string }
  | { ok: false; error: string; id?: string }
> {
  if (!input.draft.subject.trim()) return { ok: false, error: "Subject is required." };
  // Save first so we send the exact content the UI shows.
  const campaignId = await saveDraft({ ...input.draft, sendMode: "now" });
  const result = await sendCampaignNow(campaignId);
  revalidatePath(`/admin/email/campaigns`);
  revalidatePath(`/admin/email/campaigns/${campaignId}`);
  revalidatePath(`/admin/email/campaigns/${campaignId}/edit`);
  if (!result.ok) return { ok: false, error: result.error, id: campaignId };
  return {
    ok: true,
    id: campaignId,
    recipients: result.recipients,
    sent: result.sent,
    failed: result.failed,
  };
}

export async function scheduleAction(input: {
  draft: CampaignDraft;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!input.draft.subject.trim()) return { ok: false, error: "Subject is required." };
  if (!input.draft.scheduledFor) return { ok: false, error: "Pick a send time." };
  const when = new Date(input.draft.scheduledFor);
  if (!Number.isFinite(when.getTime())) return { ok: false, error: "Invalid date." };
  if (when.getTime() < Date.now() + 60_000) {
    return { ok: false, error: "Schedule at least 1 minute in the future." };
  }
  const campaignId = await saveDraft({
    ...input.draft,
    sendMode: "scheduled",
    status: "scheduled",
  });
  revalidatePath(`/admin/email/campaigns`);
  revalidatePath(`/admin/email/campaigns/${campaignId}/edit`);
  return { ok: true, id: campaignId };
}

export async function recipientCapAction(filters: AlumniFilters): Promise<{
  count: number;
  cap: number;
  overCap: boolean;
}> {
  const count = await countFilteredRecipients(filters);
  return { count, cap: MAX_RECIPIENTS_PER_CAMPAIGN, overCap: count > MAX_RECIPIENTS_PER_CAMPAIGN };
}

function splitContent(draft: CampaignDraft): { id?: string; newContent: unknown } {
  const content =
    draft.format === "newsletter"
      ? draft.newsletter ?? null
      : draft.quickNote ?? null;
  return { id: draft.id, newContent: content };
}
