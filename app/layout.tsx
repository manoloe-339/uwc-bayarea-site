import type { Metadata } from "next";
import { event } from "@/lib/event";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://uwcbayarea.org"),
  title: `${event.title} · ${event.city}`,
  description: `${event.hero.title} ${event.hero.titleItalic}. ${event.time} · ${event.venue}.`,
  openGraph: {
    title: `UWC Bay Area · ${event.dateShort} · ${event.city}`,
    description: `${event.hero.title} ${event.hero.titleItalic} — fireside chat with ${event.fireside.speakers.map((s) => s.name).join(" & ")}.`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `UWC Bay Area · ${event.dateShort}`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
