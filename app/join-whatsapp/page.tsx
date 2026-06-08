import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";
import JoinWhatsAppPageClient from "./JoinWhatsAppPageClient";

export const metadata: Metadata = {
  title: "Join UWC Bay Area WhatsApp",
  description:
    "Request access to the UWC Bay Area WhatsApp community — alumni-coordinated meals, events, and casual chat.",
};

export const dynamic = "force-dynamic";

/**
 * Standalone deep-link entry point for the WhatsApp invite flow.
 * Renders the same JoinWhatsAppModal that the homepage uses, but
 * pinned open against a clean page background so the URL can be
 * shared (in WhatsApp, email signatures, etc.) without the user
 * needing to click the green button on the homepage first.
 *
 * The homepage button and Foodies prompts still open the in-place
 * modal — this page is purely additive.
 */
export default async function JoinWhatsAppPage() {
  const settings = await getSiteSettings();
  return <JoinWhatsAppPageClient whatsappUrl={settings.whatsapp_url ?? null} />;
}
