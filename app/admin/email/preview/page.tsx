import { getSiteSettings } from "@/lib/settings";
import { event, toNewsletterEvent } from "@/lib/event";
import PreviewClient from "./PreviewClient";
import type { AlumniNewsletterProps } from "@/emails/AlumniNewsletter";
import EmailTabs from "@/components/admin/EmailTabs";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  const settings = await getSiteSettings();
  const liveEvent = toNewsletterEvent(event);

  const baseProps: Pick<AlumniNewsletterProps, "logoUrl" | "physicalAddress" | "footerTagline" | "unsubscribeUrl" | "recipientFirstName"> = {
    logoUrl: settings.logo_url ?? undefined,
    physicalAddress: settings.physical_address ?? undefined,
    footerTagline: settings.footer_tagline ?? undefined,
    unsubscribeUrl: "https://uwcbayarea.org/unsubscribe?token=PREVIEW",
    recipientFirstName: "Sarah",
  };

  const whatsappDefaults = {
    headline: settings.whatsapp_default_headline ?? undefined,
    body: settings.whatsapp_default_body ?? undefined,
    ctaLabel: settings.whatsapp_default_cta_label ?? undefined,
    ctaUrl: settings.whatsapp_url ?? "https://chat.whatsapp.com/",
  };

  const foodiesDefaults = {
    headline: settings.foodies_default_headline ?? undefined,
    body: settings.foodies_default_body ?? undefined,
    ctaLabel: settings.foodies_default_cta_label ?? undefined,
    // Fall back to the homepage so the preview always shows the CTA even if
    // the admin hasn't set a dedicated Foodies URL yet.
    ctaUrl: settings.foodies_default_cta_url ?? "https://uwcbayarea.org",
  };

  return (
    <div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">Emails</h1>
      <p className="text-[color:var(--muted)] text-sm mb-4">
        Live newsletter template rendered with current settings.
      </p>
      <EmailTabs active="preview" />
      <PreviewClient
        baseProps={baseProps}
        liveEvent={liveEvent}
        whatsappDefaults={whatsappDefaults}
        foodiesDefaults={foodiesDefaults}
      />
    </div>
  );
}
