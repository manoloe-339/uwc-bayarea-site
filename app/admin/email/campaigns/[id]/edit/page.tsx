import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { getFilteredRecipients } from "@/lib/recipients";
import { events, toNewsletterEvent } from "@/lib/event";
import ComposeForm from "../../ComposeForm";
import { emptyDraft, type CampaignDraft, type NewsletterContent, type QuickNoteContent } from "@/lib/campaign-content";
import type { AlumniFilters } from "@/lib/alumni-query";

export const dynamic = "force-dynamic";

type CampaignRow = {
  id: string;
  subject: string;
  format: string;
  mode: string | null;
  preheader: string | null;
  from_name: string | null;
  body: string | null;
  content_json: NewsletterContent | QuickNoteContent | null;
  filter_snapshot: AlumniFilters | null;
  scheduled_for: string | null;
  status: string;
};

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = (await sql`SELECT * FROM email_campaigns WHERE id = ${id}`) as CampaignRow[];
  if (rows.length === 0) notFound();
  const c = rows[0];

  const base = emptyDraft();
  const draft: CampaignDraft = {
    ...base,
    id: c.id,
    format: (c.format as CampaignDraft["format"]) ?? "quick_note",
    subject: c.subject ?? "",
    preheader: c.preheader ?? "",
    fromName: c.from_name ?? "",
    filters: c.filter_snapshot ?? { subscription: "subscribed" },
    sendMode: c.scheduled_for ? "scheduled" : "now",
    scheduledFor: c.scheduled_for ?? undefined,
    status: c.status as CampaignDraft["status"],
    quickNote:
      c.format === "quick_note"
        ? {
            body: c.body ?? "",
            salutation: (c.content_json as QuickNoteContent | null)?.salutation ?? "Hi",
            includeFirstName: (c.content_json as QuickNoteContent | null)?.includeFirstName ?? true,
          }
        : base.quickNote,
    newsletter:
      c.format === "newsletter"
        ? ({ ...base.newsletter!, ...(c.content_json as NewsletterContent) })
        : base.newsletter,
  };

  const [{ list, count }, settings] = await Promise.all([
    getFilteredRecipients(draft.filters),
    getSiteSettings(),
  ]);
  const preview = list.slice(0, 20).map((r) => ({
    id: r.id,
    name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
    email: r.email,
    firstName: r.first_name,
  }));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)]">Edit campaign</h1>
        <span className="text-[11px] uppercase tracking-[.22em] text-[color:var(--muted)]">
          {draft.status}
        </span>
      </div>
      <ComposeForm
        initial={draft}
        recipientCount={count}
        recipientPreview={preview}
        events={events.map((e) => ({
          id: e.id,
          label: e.label,
          featured: !!e.featured,
          newsletterDetails: toNewsletterEvent(e),
        }))}
        settings={{
          logoUrl: settings.logo_url ?? undefined,
          physicalAddress: settings.physical_address ?? undefined,
          footerTagline: settings.footer_tagline ?? undefined,
          whatsappDefaultHeadline: settings.whatsapp_default_headline ?? undefined,
          whatsappDefaultBody: settings.whatsapp_default_body ?? undefined,
          whatsappDefaultCtaLabel: settings.whatsapp_default_cta_label ?? undefined,
          whatsappDefaultUrl: settings.whatsapp_url ?? undefined,
          foodiesDefaultHeadline: settings.foodies_default_headline ?? undefined,
          foodiesDefaultBody: settings.foodies_default_body ?? undefined,
          foodiesDefaultCtaLabel: settings.foodies_default_cta_label ?? undefined,
          foodiesDefaultCtaUrl: settings.foodies_default_cta_url ?? "https://uwcbayarea.org",
        }}
      />
    </div>
  );
}
