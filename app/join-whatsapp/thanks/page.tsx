import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Request sent · UWC Bay Area WhatsApp",
  description: "Your WhatsApp invite request is in.",
};

export default function JoinWhatsAppThanksPage() {
  return (
    <>
      <SiteHeader />
      <section className="max-w-[640px] mx-auto px-5 sm:px-7 pt-20 sm:pt-[120px] pb-24 text-center">
        <div className="inline-flex items-center gap-3.5 text-[12px] tracking-[.32em] uppercase text-navy font-bold mb-5">
          <span className="inline-block w-8 h-0.5 bg-navy" aria-hidden />
          Request sent
        </div>
        <h1
          className="font-sans font-bold text-[color:var(--navy-ink)] mb-5 leading-[1.04] tracking-[-.025em]"
          style={{ fontSize: "clamp(36px, 5.4vw, 60px)" }}
        >
          You&rsquo;re on the list.
        </h1>
        <p className="text-[color:var(--navy-ink)] leading-[1.55] text-[17px] sm:text-[19px] mb-2">
          Your request to join the UWC Bay Area WhatsApp community is in.
        </p>
        <p className="text-[color:var(--muted)] text-[15px] leading-[1.55] mb-10">
          Manolo will send you the invite link to your email shortly. If
          you don&rsquo;t hear back within a couple of days, ping{" "}
          <a
            href="mailto:manolo@uwcbayarea.org"
            className="text-navy underline underline-offset-2"
          >
            manolo@uwcbayarea.org
          </a>
          .
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-full px-6 py-3 text-[12px] font-bold tracking-[.22em] uppercase bg-navy text-white hover:opacity-90"
        >
          ← Back to uwcbayarea.org
        </Link>
      </section>
      <SiteFooter />
    </>
  );
}
