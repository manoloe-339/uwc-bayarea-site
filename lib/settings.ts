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
  updated_at: string;
};

/** Default LinkedIn invite copy. ${firstName} is substituted client-side. */
export const DEFAULT_LINKEDIN_INVITE_TEMPLATE =
  "Hi {firstName} — Manolo here, building out the UWC Bay Area alumni network. Saw you're a UWC alum in the area. Would love to connect and keep you in the loop on our gatherings.";

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
  };

  await sql`
    UPDATE site_settings SET
      logo_url                   = ${next.logo_url},
      footer_tagline             = ${next.footer_tagline},
      physical_address           = ${next.physical_address},
      whatsapp_url               = ${next.whatsapp_url},
      whatsapp_default_headline  = ${next.whatsapp_default_headline},
      whatsapp_default_body      = ${next.whatsapp_default_body},
      whatsapp_default_cta_label = ${next.whatsapp_default_cta_label},
      foodies_default_headline   = ${next.foodies_default_headline},
      foodies_default_body       = ${next.foodies_default_body},
      foodies_default_cta_label  = ${next.foodies_default_cta_label},
      foodies_default_cta_url    = ${next.foodies_default_cta_url},
      default_from_name          = ${next.default_from_name},
      linkedin_invite_template   = ${next.linkedin_invite_template},
      updated_at                 = NOW()
    WHERE id = ${existing.id}
  `;

  return getSiteSettings();
}
