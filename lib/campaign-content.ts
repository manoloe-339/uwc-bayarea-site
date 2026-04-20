/**
 * Shared schema for a campaign's editable content. Stored as JSONB in
 * email_campaigns.content_json for newsletter campaigns, or reduced to
 * { body } for quick_note campaigns.
 */

import type { AlumniFilters } from "./alumni-query";
import type {
  EventDetails,
  Mode,
  Speaker,
  CTA,
} from "@/emails/AlumniNewsletter";

export type CampaignFormat = "quick_note" | "newsletter";

export type NewsletterContent = {
  mode: Mode;
  announcementKicker?: string;
  reminderTag?: string;
  event?: EventDetails;
  update?: {
    headline: string;
    body: string;
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    cta?: CTA;
  };
  whatsNext?: {
    show: boolean;
    tag?: string;
    title: string;
    dateline?: string;
    description?: string;
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    cta?: CTA;
  };
  whatsapp?: {
    show: boolean;
    headline?: string;
    body?: string;
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };
  foodies?: {
    show: boolean;
    headline?: string;
    body?: string;
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };
};

export type QuickNoteContent = {
  body: string;
  salutation: string;
  includeFirstName: boolean;
};

export type CampaignDraft = {
  id?: string;
  format: CampaignFormat;
  subject: string;
  preheader: string;
  fromName: string;
  filters: AlumniFilters;
  sendMode: "now" | "scheduled";
  scheduledFor?: string;
  status?: "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  quickNote?: QuickNoteContent;
  newsletter?: NewsletterContent;
};

export function emptyDraft(): CampaignDraft {
  return {
    format: "quick_note",
    subject: "",
    preheader: "",
    fromName: "",
    filters: { subscription: "subscribed" },
    sendMode: "now",
    quickNote: {
      body: "",
      salutation: "Hi",
      includeFirstName: true,
    },
    newsletter: {
      mode: "announcement",
      event: {
        title: "",
      },
      whatsNext: { show: true, title: "" },
      whatsapp: { show: true },
      foodies: { show: true },
    },
  };
}

export type { Speaker, CTA, EventDetails, Mode };
