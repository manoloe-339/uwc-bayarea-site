import { render } from "@react-email/render";
import React from "react";
import AlumniNewsletter, {
  type AlumniNewsletterProps,
} from "@/emails/AlumniNewsletter";
import { renderEmailHtml, renderEmailText } from "./email";
import { generateUnsubscribeUrl, renderPersonalization } from "./recipients";
import type { NewsletterContent, QuickNoteContent } from "./campaign-content";

export type CampaignRow = {
  id: string;
  format: string | null;
  subject: string;
  preheader: string | null;
  from_name: string | null;
  body: string | null;
  content_json: unknown;
  status: string | null;
};

export type RecipientCtx = {
  alumniId: number | null;
  email: string;
  firstName: string | null;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  preheader: string | null;
  unsubscribeUrl: string;
};

export async function renderCampaign(
  row: CampaignRow,
  recipient: RecipientCtx,
  settings: {
    logoUrl?: string | null;
    physicalAddress?: string | null;
    footerTagline?: string | null;
    whatsappDefaultHeadline?: string | null;
    whatsappDefaultBody?: string | null;
    whatsappDefaultCtaLabel?: string | null;
    whatsappDefaultUrl?: string | null;
    foodiesDefaultHeadline?: string | null;
    foodiesDefaultBody?: string | null;
    foodiesDefaultCtaLabel?: string | null;
    foodiesDefaultCtaUrl?: string | null;
  }
): Promise<RenderedEmail> {
  const firstName = (recipient.firstName ?? "").trim() || null;
  const vars = { firstName };
  const subject = renderPersonalization(row.subject, vars) || row.subject;
  const preheader = row.preheader ? renderPersonalization(row.preheader, vars) : null;
  const unsubscribeUrl =
    recipient.alumniId != null
      ? generateUnsubscribeUrl(recipient.alumniId)
      : `${appUrl()}/unsubscribe/manual`;

  if (row.format === "newsletter") {
    const content = (row.content_json ?? {}) as NewsletterContent;
    const props = buildNewsletterProps(content, recipient, settings, preheader, unsubscribeUrl);
    const html = await Promise.resolve(render(React.createElement(AlumniNewsletter, props)));
    const text = await Promise.resolve(
      render(React.createElement(AlumniNewsletter, props), { plainText: true })
    );
    return { subject, html, text, preheader, unsubscribeUrl };
  }

  // quick_note
  const qn = (row.content_json as QuickNoteContent | null) ?? null;
  const baseBody = qn?.body ?? row.body ?? "";
  const finalBody = renderPersonalization(
    wrapWithSalutation(baseBody, qn, firstName),
    vars
  );
  const html = renderEmailHtml(finalBody, recipient.alumniId);
  const text = renderEmailText(finalBody, recipient.alumniId);
  return { subject, html, text, preheader, unsubscribeUrl };
}

function wrapWithSalutation(
  body: string,
  qn: QuickNoteContent | null,
  firstName: string | null
): string {
  if (!qn) return body;
  const sal = (qn.salutation ?? "").trim();
  if (!sal) return body;
  const name = qn.includeFirstName ? ` ${firstName ? firstName : "there"}` : "";
  return `${sal}${name},\n\n${body}`;
}

function buildNewsletterProps(
  content: NewsletterContent,
  recipient: RecipientCtx,
  settings: Parameters<typeof renderCampaign>[2],
  preheader: string | null,
  unsubscribeUrl: string
): AlumniNewsletterProps {
  const vars = { firstName: (recipient.firstName ?? "").trim() || null };
  const P = (s?: string | null) => (s ? renderPersonalization(s, vars) : s ?? undefined);

  return {
    logoUrl: settings.logoUrl ?? undefined,
    physicalAddress: settings.physicalAddress ?? undefined,
    footerTagline: settings.footerTagline ?? undefined,
    recipientFirstName: vars.firstName ?? undefined,
    unsubscribeUrl,
    preheader: preheader ?? undefined,
    mode: content.mode,
    announcementKicker: P(content.announcementKicker),
    reminderTag: content.mode === "reminder" ? P(content.reminderTag) ?? "This Saturday!" : undefined,
    event:
      content.mode !== "update" && content.event
        ? {
            ...content.event,
            heroHeadline: P(content.event.heroHeadline),
            title: P(content.event.title) ?? content.event.title,
            dateline: P(content.event.dateline),
            location: P(content.event.location),
            locationNote: P(content.event.locationNote),
            description: P(content.event.description),
            cta: content.event.cta
              ? { label: P(content.event.cta.label) ?? content.event.cta.label, url: content.event.cta.url }
              : undefined,
          }
        : undefined,
    update:
      content.mode === "update" && content.update
        ? {
            ...content.update,
            headline: P(content.update.headline) ?? content.update.headline,
            body: P(content.update.body) ?? content.update.body,
            cta: content.update.cta
              ? { label: P(content.update.cta.label) ?? content.update.cta.label, url: content.update.cta.url }
              : undefined,
          }
        : undefined,
    whatsNext:
      content.whatsNext?.show && content.whatsNext.title
        ? {
            ...content.whatsNext,
            title: P(content.whatsNext.title) ?? content.whatsNext.title,
            description: P(content.whatsNext.description),
            cta: content.whatsNext.cta
              ? { label: P(content.whatsNext.cta.label) ?? content.whatsNext.cta.label, url: content.whatsNext.cta.url }
              : undefined,
          }
        : undefined,
    whatsapp: content.whatsapp?.show
      ? {
          show: true,
          headline: P(content.whatsapp.headline) ?? settings.whatsappDefaultHeadline ?? undefined,
          body: P(content.whatsapp.body) ?? settings.whatsappDefaultBody ?? undefined,
          imageUrl: content.whatsapp.imageUrl,
          imageAlt: content.whatsapp.imageAlt,
          imageCaption: content.whatsapp.imageCaption,
          ctaLabel: P(content.whatsapp.ctaLabel) ?? settings.whatsappDefaultCtaLabel ?? undefined,
          ctaUrl: content.whatsapp.ctaUrl ?? settings.whatsappDefaultUrl ?? "https://uwcbayarea.org",
        }
      : undefined,
    foodies: content.foodies?.show
      ? {
          show: true,
          headline: P(content.foodies.headline) ?? settings.foodiesDefaultHeadline ?? undefined,
          body: P(content.foodies.body) ?? settings.foodiesDefaultBody ?? undefined,
          imageUrl: content.foodies.imageUrl,
          imageAlt: content.foodies.imageAlt,
          imageCaption: content.foodies.imageCaption,
          ctaLabel: P(content.foodies.ctaLabel) ?? settings.foodiesDefaultCtaLabel ?? undefined,
          ctaUrl: content.foodies.ctaUrl ?? settings.foodiesDefaultCtaUrl ?? "https://uwcbayarea.org",
        }
      : undefined,
  };
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://uwcbayarea.org").replace(/\/+$/, "");
}
