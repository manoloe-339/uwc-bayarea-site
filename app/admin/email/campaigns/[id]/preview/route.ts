import { sql } from "@/lib/db";
import { renderCampaign, type CampaignRow, type RecipientCtx } from "@/lib/campaign-render";
import { getSiteSettings } from "@/lib/settings";
import { getFilteredRecipients } from "@/lib/recipients";
import type { AlumniFilters } from "@/lib/alumni-query";

export const dynamic = "force-dynamic";

/**
 * Admin-only: renders the campaign email exactly as a recipient sees it and
 * returns it as text/html so the admin can open it in a new tab. Picks up
 * per-recipient personalization (name + unsubscribe URL).
 *
 * /admin/email/campaigns/[id]/preview                → first recipient in filter
 * /admin/email/campaigns/[id]/preview?alumni_id=42   → specific alum
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const alumniIdParam = url.searchParams.get("alumni_id");

  const campaignRows = (await sql`
    SELECT id, format, subject, preheader, from_name, body, content_json,
           status, filter_snapshot
    FROM email_campaigns WHERE id = ${id}
  `) as (CampaignRow & { filter_snapshot: unknown })[];

  if (campaignRows.length === 0) {
    return new Response("Campaign not found", { status: 404 });
  }
  const campaign = campaignRows[0];

  const ctx = await resolveRecipient(campaign.filter_snapshot as AlumniFilters, alumniIdParam);
  if (!ctx) {
    return new Response(
      `<p style="font-family:sans-serif;padding:24px;color:#6B7280;">No recipient to render (filter produced 0 rows). Add a recipient or pass ?alumni_id=&lt;id&gt;.</p>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const settings = await getSiteSettings();
  const rendered = await renderCampaign(campaign, ctx, {
    logoUrl: settings.logo_url,
    physicalAddress: settings.physical_address,
    footerTagline: settings.footer_tagline,
    whatsappDefaultHeadline: settings.whatsapp_default_headline,
    whatsappDefaultBody: settings.whatsapp_default_body,
    whatsappDefaultCtaLabel: settings.whatsapp_default_cta_label,
    whatsappDefaultUrl: settings.whatsapp_url,
    foodiesDefaultHeadline: settings.foodies_default_headline,
    foodiesDefaultBody: settings.foodies_default_body,
    foodiesDefaultCtaLabel: settings.foodies_default_cta_label,
    foodiesDefaultCtaUrl: settings.foodies_default_cta_url,
  });

  return new Response(rendered.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}

async function resolveRecipient(
  filters: AlumniFilters | null | undefined,
  alumniIdParam: string | null
): Promise<RecipientCtx | null> {
  // Explicit alumni_id wins.
  if (alumniIdParam) {
    const n = Number(alumniIdParam);
    if (Number.isFinite(n)) {
      const rows = (await sql`
        SELECT id, email, first_name, last_name FROM alumni WHERE id = ${n}
      `) as { id: number; email: string; first_name: string | null; last_name: string | null }[];
      if (rows[0]) {
        return { alumniId: rows[0].id, email: rows[0].email, firstName: rows[0].first_name };
      }
    }
  }
  // Fall back to first recipient in the filter snapshot.
  if (filters) {
    const { list } = await getFilteredRecipients(filters);
    if (list[0]) {
      return { alumniId: list[0].id, email: list[0].email, firstName: list[0].first_name };
    }
  }
  return null;
}
