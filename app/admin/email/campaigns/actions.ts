"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import type { CampaignDraft } from "@/lib/campaign-content";

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

function splitContent(draft: CampaignDraft): { id?: string; newContent: unknown } {
  const content =
    draft.format === "newsletter"
      ? draft.newsletter ?? null
      : draft.quickNote ?? null;
  return { id: draft.id, newContent: content };
}
