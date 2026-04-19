import { sql } from "./db";
import { getResend, fromAddress, replyToAddress } from "./resend";
import { renderEmailHtml, renderEmailText } from "./email";
import { searchAlumni, getAlumniByIds, type AlumniFilters, type AlumniRow } from "./alumni-query";

const BATCH_SIZE = 100;
const MAX_RECIPIENTS = 5000; // safety cap

export async function getRecipients(filters: AlumniFilters): Promise<AlumniRow[]> {
  if (filters.ids && filters.ids.length > 0) {
    const rows = await getAlumniByIds(filters.ids);
    return rows.filter((r) => r.email && r.email.includes("@"));
  }
  const safe: AlumniFilters = { ...filters, subscription: "subscribed" };
  const rows = await searchAlumni(safe, MAX_RECIPIENTS);
  return rows.filter((r) => r.email && r.email.includes("@"));
}

function buildBody(params: {
  body: string;
  salutation?: string;
  includeFirstName?: boolean;
  firstName?: string | null;
}): string {
  const sal = (params.salutation ?? "").trim();
  if (!sal) return params.body;
  const name = params.includeFirstName
    ? ` ${params.firstName && params.firstName.trim() ? params.firstName.trim() : "there"}`
    : "";
  return `${sal}${name},\n\n${params.body}`;
}

export async function sendTestEmail(params: {
  to: string;
  subject: string;
  body: string;
  salutation?: string;
  includeFirstName?: boolean;
  firstName?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const resend = getResend();
    const finalBody = buildBody({
      body: params.body,
      salutation: params.salutation,
      includeFirstName: params.includeFirstName,
      firstName: params.firstName ?? null,
    });
    const html = renderEmailHtml(finalBody, null);
    const text = renderEmailText(finalBody, null);
    const result = await resend.emails.send({
      from: fromAddress(),
      to: params.to,
      replyTo: replyToAddress(),
      subject: params.subject,
      html,
      text,
    });
    if ("error" in result && result.error) {
      return { ok: false, error: result.error.message ?? "send failed" };
    }
    const id = "data" in result && result.data ? result.data.id : "";
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

type BatchItem = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendCampaign(params: {
  filters: AlumniFilters;
  subject: string;
  body: string;
  salutation?: string;
  includeFirstName?: boolean;
  createdBy?: string;
}): Promise<{
  campaignId: string;
  recipients: number;
  sent: number;
  failed: number;
}> {
  const recipients = await getRecipients(params.filters);
  const campaign = (await sql`
    INSERT INTO email_campaigns (subject, body, filter_snapshot, recipient_count, created_by)
    VALUES (
      ${params.subject},
      ${params.body},
      ${JSON.stringify(params.filters)}::jsonb,
      ${recipients.length},
      ${params.createdBy ?? null}
    )
    RETURNING id
  `) as { id: string }[];
  const campaignId = campaign[0].id;

  if (recipients.length === 0) {
    return { campaignId, recipients: 0, sent: 0, failed: 0 };
  }

  const resend = getResend();
  const from = fromAddress();
  const replyTo = replyToAddress();

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const personalized = chunk.map((r) => ({
      recipient: r,
      body: buildBody({
        body: params.body,
        salutation: params.salutation,
        includeFirstName: params.includeFirstName,
        firstName: r.first_name,
      }),
    }));
    const items: BatchItem[] = personalized.map(({ recipient, body }) => ({
      from,
      to: recipient.email,
      replyTo,
      subject: params.subject,
      html: renderEmailHtml(body, recipient.id),
      text: renderEmailText(body, recipient.id),
    }));

    try {
      const result = await resend.batch.send(items);
      if ("error" in result && result.error) {
        // Whole batch failed — mark every row as failed.
        for (const p of personalized) {
          await insertSendRow(campaignId, p.recipient, params.subject, p.body, {
            status: "failed",
            error: result.error.message ?? "batch_failed",
          });
          failed++;
        }
        console.error(`[sendCampaign] batch failed:`, result.error);
        continue;
      }
      const data =
        "data" in result && result.data
          ? ((result.data as { data?: { id: string }[] }).data ?? [])
          : [];
      for (let j = 0; j < personalized.length; j++) {
        const { recipient, body } = personalized[j];
        const messageId = data[j]?.id ?? null;
        if (messageId) {
          await insertSendRow(campaignId, recipient, params.subject, body, {
            status: "sent",
            resend_message_id: messageId,
            sent_at: new Date(),
          });
          sent++;
        } else {
          await insertSendRow(campaignId, recipient, params.subject, body, {
            status: "failed",
            error: "no_message_id",
          });
          failed++;
        }
      }
    } catch (err) {
      for (const p of personalized) {
        await insertSendRow(campaignId, p.recipient, params.subject, p.body, {
          status: "failed",
          error: err instanceof Error ? err.message : "unknown",
        });
        failed++;
      }
      console.error(`[sendCampaign] batch threw:`, err);
    }
  }

  await sql`
    UPDATE email_campaigns SET sent_count = ${sent}, failed_count = ${failed}
    WHERE id = ${campaignId}
  `;

  console.log(
    `[sendCampaign] campaign=${campaignId} recipients=${recipients.length} sent=${sent} failed=${failed}`
  );
  return { campaignId, recipients: recipients.length, sent, failed };
}

async function insertSendRow(
  campaignId: string,
  recipient: AlumniRow,
  subject: string,
  body: string,
  opts: {
    status: string;
    resend_message_id?: string;
    error?: string;
    sent_at?: Date;
  }
): Promise<void> {
  await sql`
    INSERT INTO email_sends (
      campaign_id, alumni_id, email, subject, body,
      resend_message_id, status, error, sent_at
    ) VALUES (
      ${campaignId}, ${recipient.id}, ${recipient.email},
      ${subject}, ${body},
      ${opts.resend_message_id ?? null}, ${opts.status},
      ${opts.error ?? null}, ${opts.sent_at ?? null}
    )
  `;
}
