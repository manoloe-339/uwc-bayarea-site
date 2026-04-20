import { getSiteSettings } from "@/lib/settings";
import { event } from "@/lib/event";
import PreviewClient from "./PreviewClient";
import type { AlumniNewsletterProps, Speaker } from "@/emails/AlumniNewsletter";

export const dynamic = "force-dynamic";

/** Convert the live event from lib/event.ts into newsletter event props. */
function liveEventDetails() {
  const dateShort = "Friday, May 1, 2026";
  const speakers: Speaker[] = [
    ...event.speakers.map((s) => ({ name: s.name, title: s.role })),
    ...(event.fireside?.speakers ?? []).map((s) => ({
      name: s.name,
      title: `${s.role} · ${s.org.join(", ")}`,
    })),
  ];
  return {
    title: event.hero.title + " " + event.hero.titleItalic,
    heroHeadline: "Our next event: eSwatini's story",
    imageUrl: "https://uwcbayarea.org/waterford-bg.jpg",
    imageAlt: "UWC Waterford Kamhlaba campus",
    dateline: `${dateShort} · ${event.time}`,
    location: event.venue,
    locationNote: event.venueNeighborhood,
    description: event.hero.body,
    speakers,
    cta: { label: `Get tickets · ${event.price}`, url: event.ticketUrl },
  };
}

export default async function PreviewPage() {
  const settings = await getSiteSettings();
  const liveEvent = liveEventDetails();

  const baseProps: Pick<AlumniNewsletterProps, "logoUrl" | "physicalAddress" | "unsubscribeUrl" | "recipientFirstName"> = {
    logoUrl: settings.logo_url ?? undefined,
    physicalAddress: settings.physical_address ?? undefined,
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
    <PreviewClient
      baseProps={baseProps}
      liveEvent={liveEvent}
      whatsappDefaults={whatsappDefaults}
      foodiesDefaults={foodiesDefaults}
    />
  );
}
