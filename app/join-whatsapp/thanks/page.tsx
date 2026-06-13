import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Request sent · UWC Bay Area WhatsApp",
  description: "Your WhatsApp invite request is in.",
};

/**
 * Two states share this URL:
 *
 *  - Default (no query) — the public registered-form / visiting-form
 *    path. The submission was queued for admin review; Manolo sends
 *    the invite manually.
 *  - `?sent=auto` — the trusted-token path from the signup-
 *    confirmation email. The WhatsApp invite was already auto-sent
 *    to the alum's registered email at submit time.
 *
 * Copy adapts so the recipient knows whether to wait for a
 * follow-up email or to start checking their inbox.
 */
export default async function JoinWhatsAppThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const sp = await searchParams;
  const isAutoSent = sp.sent === "auto";

  return (
    <>
      <SiteHeader />
      <section className="max-w-[640px] mx-auto px-5 sm:px-7 pt-20 sm:pt-[120px] pb-24 text-center">
        <div className="inline-flex items-center gap-3.5 text-[12px] tracking-[.32em] uppercase text-navy font-bold mb-5">
          <span className="inline-block w-8 h-0.5 bg-navy" aria-hidden />
          {isAutoSent ? "Invite sent" : "Request sent"}
        </div>
        <h1
          className="font-sans font-bold text-[color:var(--navy-ink)] mb-5 leading-[1.04] tracking-[-.025em]"
          style={{ fontSize: "clamp(36px, 5.4vw, 60px)" }}
        >
          {isAutoSent ? (
            <>Check your <em className="italic font-semibold">inbox</em>.</>
          ) : (
            <>You&rsquo;re on the list.</>
          )}
        </h1>
        {isAutoSent ? (
          <>
            <p className="text-[color:var(--navy-ink)] leading-[1.55] text-[17px] sm:text-[19px] mb-2">
              We just sent the UWC Bay Area WhatsApp invite to your
              registered email.
            </p>
            <p className="text-[color:var(--muted)] text-[15px] leading-[1.55] mb-10">
              If it doesn&rsquo;t show up within a few minutes, check
              your spam folder, or reply to the signup confirmation
              email and we&rsquo;ll resend.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
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
