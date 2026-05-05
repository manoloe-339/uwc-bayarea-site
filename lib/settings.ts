import { sql } from "./db";

export type SiteSettings = {
  id: string;
  logo_url: string | null;
  footer_tagline: string | null;
  physical_address: string | null;
  whatsapp_url: string | null;
  whatsapp_default_headline: string | null;
  whatsapp_default_body: string | null;
  whatsapp_default_cta_label: string | null;
  foodies_default_headline: string | null;
  foodies_default_body: string | null;
  foodies_default_cta_label: string | null;
  foodies_default_cta_url: string | null;
  default_from_name: string | null;
  linkedin_invite_template: string | null;
  photo_gallery_thumbs_per_row: number;
  photo_gallery_marquee_paused: boolean;
  photo_gallery_show_intro: boolean;
  photo_gallery_slide_duration_sec: number;
  photo_gallery_marquee_speed_sec: number;
  photo_gallery_intro_eyebrow: string | null;
  photo_gallery_intro_headline: string | null;
  photo_gallery_intro_headline_accent: string | null;
  photo_gallery_intro_subhead: string | null;
  signup_confirmation_subject: string | null;
  signup_confirmation_body_md: string | null;
  whatsapp_invite_subject: string | null;
  whatsapp_invite_body_md: string | null;
  updated_at: string;
};

/** Default signup confirmation email — used when the admin-editable
 * settings are blank. Subject + plain-text body. The body falls
 * through the markdown renderer harmlessly (no markdown syntax inside,
 * so it passes as-is). */
export const DEFAULT_SIGNUP_CONFIRMATION = {
  subject: "Welcome to UWC Bay Area",
  bodyMd: `Thanks for signing up with UWC Bay Area.

We've saved your details. You'll hear from us when we're organizing events or have news worth sharing — usually not more than once or twice a month.

{college_blurb}

You can reply to this email any time (it'll reach our team directly), and every message we send has an unsubscribe link at the bottom.

Looking forward to connecting,
UWC Bay Area`,
};

/** Default WhatsApp invite email — used when the admin-editable
 * settings are blank. Subject + markdown body. The `Hi {firstName},`
 * salutation is auto-prepended at send time. {whatsapp_url} is
 * substituted from site_settings.whatsapp_url so the join link can be
 * rotated without editing the template. */
export const DEFAULT_WHATSAPP_INVITE = {
  subject: "Welcome to the UWC Bay Area WhatsApp",
  bodyMd: `Welcome!

Thanks for signing up. Here's the link for the UWC Bay Area WhatsApp: {whatsapp_url}. Our admins will approve once you connect. [Guidelines for our WhatsApp](https://uwcbayarea.org/whatsapp-guidelines) are posted in the General Chat and on our website.

Please note that our 2026 Foodies events are managed entirely through WhatsApp. For each event, we create a specific subgroup where hosts post details regarding the theme, location, and RSVP. These subgroups serve as the hub for all logistics and communication for those interested in attending that particular gathering, and are closed once the event concludes. (Check the group description for more information.)

(Hat tip to the London Foodies group for their playbook!)

We have two Foodies gatherings here in May: May 9th in San Jose, and May 15th in San Francisco.

Let us know if you have any questions.

Manolo`,
};

/** Default LinkedIn invite copy. ${firstName} is substituted client-side. */
export const DEFAULT_LINKEDIN_INVITE_TEMPLATE =
  "Hi {firstName} — Manolo here, building out the UWC Bay Area alumni network. Saw you're a UWC alum in the area. Would love to connect and keep you in the loop on our gatherings.";

/** Default copy for the /photos intro band. Used when settings are null. */
export const DEFAULT_PHOTO_GALLERY_INTRO = {
  eyebrow: "Photographs · 1976 — present",
  headline: "A community,",
  headlineAccent: "in pictures",
  subhead:
    "Half a century of dinners, firesides, picnics, and weddings — submitted by alumni and stitched together here. New galleries appear at the top as they're added.",
};

/**
 * Fetch the singleton site_settings row. Falls back to a minimal in-memory
 * default if the table is empty (should only happen before the seed runs).
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = (await sql`SELECT * FROM site_settings ORDER BY updated_at DESC LIMIT 1`) as SiteSettings[];
  if (rows.length > 0) return rows[0];
  return {
    id: "fallback",
    logo_url: null,
    footer_tagline: "A UWCx Initiative",
    physical_address: null,
    whatsapp_url: null,
    whatsapp_default_headline: "Join the WhatsApp community",
    whatsapp_default_body:
      "Stay in the loop with Bay Area UWC alumni. Announcements, carpools, and conversations.",
    whatsapp_default_cta_label: "Join WhatsApp",
    foodies_default_headline: "UWC Foodies",
    foodies_default_body:
      "Informal gatherings sharing food across the Bay Area, rotating locations monthly.",
    foodies_default_cta_label: "Learn more",
    foodies_default_cta_url: null,
    default_from_name: "UWC Bay Area",
    linkedin_invite_template: DEFAULT_LINKEDIN_INVITE_TEMPLATE,
    photo_gallery_thumbs_per_row: 4,
    photo_gallery_marquee_paused: false,
    photo_gallery_show_intro: true,
    photo_gallery_slide_duration_sec: 5,
    photo_gallery_marquee_speed_sec: 70,
    photo_gallery_intro_eyebrow: DEFAULT_PHOTO_GALLERY_INTRO.eyebrow,
    photo_gallery_intro_headline: DEFAULT_PHOTO_GALLERY_INTRO.headline,
    photo_gallery_intro_headline_accent: DEFAULT_PHOTO_GALLERY_INTRO.headlineAccent,
    photo_gallery_intro_subhead: DEFAULT_PHOTO_GALLERY_INTRO.subhead,
    signup_confirmation_subject: null,
    signup_confirmation_body_md: null,
    whatsapp_invite_subject: null,
    whatsapp_invite_body_md: null,
    updated_at: new Date().toISOString(),
  };
}

export async function updateSiteSettings(patch: Partial<Omit<SiteSettings, "id" | "updated_at">>): Promise<SiteSettings> {
  const existing = await getSiteSettings();
  const next: Omit<SiteSettings, "id" | "updated_at"> = {
    logo_url: patch.logo_url ?? existing.logo_url,
    footer_tagline: patch.footer_tagline ?? existing.footer_tagline,
    physical_address: patch.physical_address ?? existing.physical_address,
    whatsapp_url: patch.whatsapp_url ?? existing.whatsapp_url,
    whatsapp_default_headline: patch.whatsapp_default_headline ?? existing.whatsapp_default_headline,
    whatsapp_default_body: patch.whatsapp_default_body ?? existing.whatsapp_default_body,
    whatsapp_default_cta_label: patch.whatsapp_default_cta_label ?? existing.whatsapp_default_cta_label,
    foodies_default_headline: patch.foodies_default_headline ?? existing.foodies_default_headline,
    foodies_default_body: patch.foodies_default_body ?? existing.foodies_default_body,
    foodies_default_cta_label: patch.foodies_default_cta_label ?? existing.foodies_default_cta_label,
    foodies_default_cta_url: patch.foodies_default_cta_url ?? existing.foodies_default_cta_url,
    default_from_name: patch.default_from_name ?? existing.default_from_name,
    linkedin_invite_template:
      patch.linkedin_invite_template !== undefined
        ? patch.linkedin_invite_template
        : existing.linkedin_invite_template,
    photo_gallery_thumbs_per_row:
      patch.photo_gallery_thumbs_per_row ?? existing.photo_gallery_thumbs_per_row,
    photo_gallery_marquee_paused:
      patch.photo_gallery_marquee_paused ?? existing.photo_gallery_marquee_paused,
    photo_gallery_show_intro:
      patch.photo_gallery_show_intro ?? existing.photo_gallery_show_intro,
    photo_gallery_slide_duration_sec:
      patch.photo_gallery_slide_duration_sec ?? existing.photo_gallery_slide_duration_sec,
    photo_gallery_marquee_speed_sec:
      patch.photo_gallery_marquee_speed_sec ?? existing.photo_gallery_marquee_speed_sec,
    photo_gallery_intro_eyebrow:
      patch.photo_gallery_intro_eyebrow !== undefined
        ? patch.photo_gallery_intro_eyebrow
        : existing.photo_gallery_intro_eyebrow,
    photo_gallery_intro_headline:
      patch.photo_gallery_intro_headline !== undefined
        ? patch.photo_gallery_intro_headline
        : existing.photo_gallery_intro_headline,
    photo_gallery_intro_headline_accent:
      patch.photo_gallery_intro_headline_accent !== undefined
        ? patch.photo_gallery_intro_headline_accent
        : existing.photo_gallery_intro_headline_accent,
    photo_gallery_intro_subhead:
      patch.photo_gallery_intro_subhead !== undefined
        ? patch.photo_gallery_intro_subhead
        : existing.photo_gallery_intro_subhead,
    signup_confirmation_subject:
      patch.signup_confirmation_subject !== undefined
        ? patch.signup_confirmation_subject
        : existing.signup_confirmation_subject,
    signup_confirmation_body_md:
      patch.signup_confirmation_body_md !== undefined
        ? patch.signup_confirmation_body_md
        : existing.signup_confirmation_body_md,
    whatsapp_invite_subject:
      patch.whatsapp_invite_subject !== undefined
        ? patch.whatsapp_invite_subject
        : existing.whatsapp_invite_subject,
    whatsapp_invite_body_md:
      patch.whatsapp_invite_body_md !== undefined
        ? patch.whatsapp_invite_body_md
        : existing.whatsapp_invite_body_md,
  };

  await sql`
    UPDATE site_settings SET
      logo_url                              = ${next.logo_url},
      footer_tagline                        = ${next.footer_tagline},
      physical_address                      = ${next.physical_address},
      whatsapp_url                          = ${next.whatsapp_url},
      whatsapp_default_headline             = ${next.whatsapp_default_headline},
      whatsapp_default_body                 = ${next.whatsapp_default_body},
      whatsapp_default_cta_label            = ${next.whatsapp_default_cta_label},
      foodies_default_headline              = ${next.foodies_default_headline},
      foodies_default_body                  = ${next.foodies_default_body},
      foodies_default_cta_label             = ${next.foodies_default_cta_label},
      foodies_default_cta_url               = ${next.foodies_default_cta_url},
      default_from_name                     = ${next.default_from_name},
      linkedin_invite_template              = ${next.linkedin_invite_template},
      photo_gallery_thumbs_per_row          = ${next.photo_gallery_thumbs_per_row},
      photo_gallery_marquee_paused          = ${next.photo_gallery_marquee_paused},
      photo_gallery_show_intro              = ${next.photo_gallery_show_intro},
      photo_gallery_slide_duration_sec      = ${next.photo_gallery_slide_duration_sec},
      photo_gallery_marquee_speed_sec       = ${next.photo_gallery_marquee_speed_sec},
      photo_gallery_intro_eyebrow           = ${next.photo_gallery_intro_eyebrow},
      photo_gallery_intro_headline          = ${next.photo_gallery_intro_headline},
      photo_gallery_intro_headline_accent   = ${next.photo_gallery_intro_headline_accent},
      photo_gallery_intro_subhead           = ${next.photo_gallery_intro_subhead},
      signup_confirmation_subject           = ${next.signup_confirmation_subject},
      signup_confirmation_body_md           = ${next.signup_confirmation_body_md},
      whatsapp_invite_subject               = ${next.whatsapp_invite_subject},
      whatsapp_invite_body_md               = ${next.whatsapp_invite_body_md},
      updated_at                            = NOW()
    WHERE id = ${existing.id}
  `;

  return getSiteSettings();
}
