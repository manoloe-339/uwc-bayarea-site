import { sql } from "./db";
import { getResend, fromAddress, replyToAddress } from "./resend";
import { getFilteredRecipients, type Recipient } from "./recipients";
import { renderCampaign, type CampaignRow, type RecipientCtx } from "./campaign-render";
import { getSiteSettings } from "./settings";
import { acquireCampaignLock, releaseCampaignLock } from "./send-lock";
import type { AlumniFilters } from "./alumni-query";

export const MAX_RECIPIENTS_PER_CAMPAIGN = 600;
export const BATCH_SIZE = 100;

type DbCampaign = CampaignRow & {
  filter_snapshot: unknown;
  recipient_count: number;
};

type SettingsShape = Awaited<ReturnType<typeof getSiteSettings>>;

function fromWithName(fromName: string | null | undefined): string {
  const addr = fromAddress();
  if (!fromName) return addr;
  const cleaned = fromName.replace(/["<>]/g, "").trim();
  if (!cleaned) return addr;
  if (/<.+@.+>/.test(addr)) return `${cleaned} ${addr.slice(addr.indexOf("<"))}`;
  return `${cleaned} <${addr}>`;
}

function toSettingsForRender(s: SettingsShape) {
  return {
    logoUrl: s.logo_url,
    physicalAddress: s.physical_address,
    footerTagline: s.footer_tagline,
    whatsappDefaultHeadline: s.whatsapp_default_headline,
    whatsappDefaultBody: s.whatsapp_default_body,
    whatsappDefaultCtaLabel: s.whatsapp_default_cta_label,
    whatsappDefaultUrl: s.whatsapp_url,
    foodiesDefaultHeadline: s.foodies_default_headline,
    foodiesDefaultBody: s.foodies_default_body,
    foodiesDefaultCtaLabel: s.foodies_default_cta_label,
    foodiesDefaultCtaUrl: s.foodies_default_cta_url,
  };
}

async function loadCampaign(id: string): Promise<DbCampaign | null> {
  const rows = (await sql`
    SELECT id, format, subject, preheader, from_name, body, content_json,
           status, filter_snapshot, recipient_count
    FROM email_campaigns WHERE id = ${id}
  `) as DbCampaign[];
  return rows[0] ?? null;
}

/**
 * Send a test of a saved campaign to one address. Uses the same renderer as
 * the real send so the admin sees the actual email their audience will receive.
 * If `firstName` is blank the test recipient gets the same empty-string
 * personalization behavior as a real alum with no first name.
 */
export async function sendCampaignTest(args: {
  campaignId: string;
  toEmail: string;
  firstName?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const campaign = await loadCampaign(args.campaignId);
  if (!campaign) return { ok: false, error: "Campaign not found" };

  const settings = await getSiteSettings();
  const rCtx: RecipientCtx = {
    alumniId: null, // test address isn't a real alum — unsubscribe link goes to manual
    email: args.toEmail,
    firstName: args.firstName ?? null,
  };

  const rendered = await renderCampaign(campaign, rCtx, toSettingsForRender(settings));
  const resend = getResend();
  const result = await resend.emails.send({
    from: fromWithName(campaign.from_name),
    to: args.toEmail,
    replyTo: replyToAddress(),
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
    headers: {
      "List-Unsubscribe": `<${rendered.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if ("error" in result && result.error) {
    return { ok: false, error: result.error.message ?? "send failed" };
  }
  const id = "data" in result && result.data ? result.data.id : "";

  // Record the test send for audit, keyed as is_test=true, no alumni_id.
  await sql`
    INSERT INTO email_sends (campaign_id, alumni_id, email, subject, body,
                             resend_message_id, status, sent_at, is_test)
    VALUES (${args.campaignId}, NULL, ${args.toEmail},
            ${rendered.subject}, ${rendered.text},
            ${id || null}, 'sent', NOW(), TRUE)
  `;

  return { ok: true, id };
}

/**
 * Fire a campaign for real. Acquires a per-campaign lock, validates status and
 * recipient cap, renders per-recipient, batches via Resend, upserts email_sends
 * rows idempotently, updates campaign tallies, and releases the lock.
 *
 * Safe to retry: the unique index on (campaign_id, alumni_id) + ON CONFLICT
 * upsert means a second invocation won't duplicate rows, and already-sent rows
 * keep their existing resend_message_id.
 */
export async function sendCampaignNow(
  campaignId: string
): Promise<{ ok: true; recipients: number; sent: number; failed: number } | { ok: false; error: string }> {
  const locked = await acquireCampaignLock(campaignId);
  if (!locked) return { ok: false, error: "Another send is already running for this campaign." };

  try {
    const campaign = await loadCampaign(campaignId);
    if (!campaign) return { ok: false, error: "Campaign not found" };

    if (!["draft", "scheduled", "failed"].includes(campaign.status ?? "")) {
      return { ok: false, error: `Campaign is ${campaign.status}; cannot send.` };
    }

    const filters = (campaign.filter_snapshot as AlumniFilters) ?? {};
    const { list: recipients } = await getFilteredRecipients(filters);

    if (recipients.length === 0) {
      await sql`
        UPDATE email_campaigns
        SET status = 'failed', failed_count = 0, recipient_count = 0
        WHERE id = ${campaignId}
      `;
      return { ok: false, error: "No deliverable recipients." };
    }

    if (recipients.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
      return {
        ok: false,
        error: `Recipient count (${recipients.length}) exceeds cap of ${MAX_RECIPIENTS_PER_CAMPAIGN}. Narrow the filter or raise the cap in lib/campaign-send.ts.`,
      };
    }

    // Mark sending + final recipient count.
    await sql`
      UPDATE email_campaigns
      SET status = 'sending', recipient_count = ${recipients.length}
      WHERE id = ${campaignId}
    `;

    const settings = await getSiteSettings();
    const renderSettings = toSettingsForRender(settings);
    const resend = getResend();
    const from = fromWithName(campaign.from_name);
    const replyTo = replyToAddress();

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);
      const rendered = await Promise.all(
        chunk.map(async (r) => {
          const ctx: RecipientCtx = {
            alumniId: r.id,
            email: r.email,
            firstName: r.first_name,
          };
          const e = await renderCampaign(campaign, ctx, renderSettings);
          return { r, e };
        })
      );

      const items = rendered.map(({ r, e }) => ({
        from,
        to: r.email,
        replyTo,
        subject: e.subject,
        html: e.html,
        text: e.text,
        headers: {
          "List-Unsubscribe": `<${e.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }));

      try {
        const result = await resend.batch.send(items);
        if ("error" in result && result.error) {
          for (const { r, e } of rendered) {
            await upsertSendRow(campaignId, r, e.subject, e.text, {
              status: "failed",
              error: result.error.message ?? "batch_failed",
            });
            failed++;
          }
          console.error(`[sendCampaignNow] batch failed:`, result.error);
          continue;
        }
        const data =
          "data" in result && result.data
            ? ((result.data as { data?: { id: string }[] }).data ?? [])
            : [];
        for (let j = 0; j < rendered.length; j++) {
          const { r, e } = rendered[j];
          const messageId = data[j]?.id ?? null;
          if (messageId) {
            await upsertSendRow(campaignId, r, e.subject, e.text, {
              status: "sent",
              resend_message_id: messageId,
              sent_at: new Date(),
            });
            sent++;
          } else {
            await upsertSendRow(campaignId, r, e.subject, e.text, {
              status: "failed",
              error: "no_message_id",
            });
            failed++;
          }
        }
      } catch (err) {
        for (const { r, e } of rendered) {
          await upsertSendRow(campaignId, r, e.subject, e.text, {
            status: "failed",
            error: err instanceof Error ? err.message : "unknown",
          });
          failed++;
        }
        console.error(`[sendCampaignNow] batch threw:`, err);
      }
    }

    const finalStatus = failed === 0 ? "sent" : sent === 0 ? "failed" : "sent";
    await sql`
      UPDATE email_campaigns
      SET status = ${finalStatus}, sent_at = NOW(),
          sent_count = ${sent}, failed_count = ${failed}
      WHERE id = ${campaignId}
    `;

    console.log(
      `[sendCampaignNow] campaign=${campaignId} recipients=${recipients.length} sent=${sent} failed=${failed}`
    );

    return { ok: true, recipients: recipients.length, sent, failed };
  } finally {
    await releaseCampaignLock(campaignId);
  }
}

/**
 * Retry only the failed rows of a campaign. Uses the same batch + upsert path
 * as a full send but restricts the recipient list to alumni whose previous
 * email_sends row is `failed`. Safe to call on a 'sent' or 'failed' campaign —
 * we'll recompute tallies at the end.
 */
export async function retryFailedSends(
  campaignId: string
): Promise<{ ok: true; retried: number; sent: number; failed: number } | { ok: false; error: string }> {
  const locked = await acquireCampaignLock(campaignId);
  if (!locked) return { ok: false, error: "Another send is already running for this campaign." };
  try {
    const campaign = await loadCampaign(campaignId);
    if (!campaign) return { ok: false, error: "Campaign not found" };

    const failedRows = (await sql`
      SELECT s.alumni_id, s.email, a.first_name, a.last_name
      FROM email_sends s
      JOIN alumni a ON a.id = s.alumni_id
      WHERE s.campaign_id = ${campaignId}
        AND s.status = 'failed'
        AND s.is_test IS NOT TRUE
        AND a.email_invalid IS NOT TRUE
        AND a.subscribed = TRUE
    `) as {
      alumni_id: number;
      email: string;
      first_name: string | null;
      last_name: string | null;
    }[];

    if (failedRows.length === 0) {
      return { ok: true, retried: 0, sent: 0, failed: 0 };
    }

    const recipients: Recipient[] = failedRows.map((r) => ({
      id: r.alumni_id,
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
    }));

    await sql`UPDATE email_campaigns SET status = 'sending' WHERE id = ${campaignId}`;

    const settings = await getSiteSettings();
    const renderSettings = toSettingsForRender(settings);
    const resend = getResend();
    const from = fromWithName(campaign.from_name);
    const replyTo = replyToAddress();

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);
      const rendered = await Promise.all(
        chunk.map(async (r) => {
          const ctx: RecipientCtx = {
            alumniId: r.id,
            email: r.email,
            firstName: r.first_name,
          };
          const e = await renderCampaign(campaign, ctx, renderSettings);
          return { r, e };
        })
      );
      const items = rendered.map(({ r, e }) => ({
        from,
        to: r.email,
        replyTo,
        subject: e.subject,
        html: e.html,
        text: e.text,
        headers: {
          "List-Unsubscribe": `<${e.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }));
      try {
        const result = await resend.batch.send(items);
        if ("error" in result && result.error) {
          for (const { r, e } of rendered) {
            await upsertSendRow(campaignId, r, e.subject, e.text, {
              status: "failed",
              error: result.error.message ?? "batch_failed",
            });
            failed++;
          }
          continue;
        }
        const data =
          "data" in result && result.data
            ? ((result.data as { data?: { id: string }[] }).data ?? [])
            : [];
        for (let j = 0; j < rendered.length; j++) {
          const { r, e } = rendered[j];
          const messageId = data[j]?.id ?? null;
          if (messageId) {
            await upsertSendRow(campaignId, r, e.subject, e.text, {
              status: "sent",
              resend_message_id: messageId,
              sent_at: new Date(),
            });
            sent++;
          } else {
            await upsertSendRow(campaignId, r, e.subject, e.text, {
              status: "failed",
              error: "no_message_id",
            });
            failed++;
          }
        }
      } catch (err) {
        for (const { r, e } of rendered) {
          await upsertSendRow(campaignId, r, e.subject, e.text, {
            status: "failed",
            error: err instanceof Error ? err.message : "unknown",
          });
          failed++;
        }
      }
    }

    // Recompute final tallies from the canonical table.
    const [total] = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent' AND is_test IS NOT TRUE)::int AS sent,
        COUNT(*) FILTER (WHERE status = 'failed' AND is_test IS NOT TRUE)::int AS failed
      FROM email_sends WHERE campaign_id = ${campaignId}
    `) as { sent: number; failed: number }[];

    const finalStatus = total.failed === 0 ? "sent" : total.sent === 0 ? "failed" : "sent";
    await sql`
      UPDATE email_campaigns
      SET status = ${finalStatus}, sent_count = ${total.sent}, failed_count = ${total.failed}
      WHERE id = ${campaignId}
    `;

    console.log(
      `[retryFailedSends] campaign=${campaignId} retried=${recipients.length} sent=${sent} failed=${failed}`
    );
    return { ok: true, retried: recipients.length, sent, failed };
  } finally {
    await releaseCampaignLock(campaignId);
  }
}

/**
 * Idempotent upsert keyed on (campaign_id, alumni_id). If the row already
 * exists (e.g. partial-send retry), we only overwrite status when we now have
 * something better than 'pending' — keeps previous delivery/open timestamps.
 */
async function upsertSendRow(
  campaignId: string,
  recipient: Recipient,
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
    ON CONFLICT (campaign_id, alumni_id)
    WHERE campaign_id IS NOT NULL AND alumni_id IS NOT NULL
    DO UPDATE SET
      email             = EXCLUDED.email,
      subject           = EXCLUDED.subject,
      body              = EXCLUDED.body,
      resend_message_id = COALESCE(EXCLUDED.resend_message_id, email_sends.resend_message_id),
      status            = CASE
                            WHEN email_sends.status IN ('sent','delivered') THEN email_sends.status
                            ELSE EXCLUDED.status
                          END,
      error             = EXCLUDED.error,
      sent_at           = COALESCE(email_sends.sent_at, EXCLUDED.sent_at)
  `;
}
