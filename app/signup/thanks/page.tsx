import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Welcome · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default function SignupThanksPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-ivory min-h-[calc(100vh-140px)]">
        <section className="max-w-[720px] mx-auto px-5 sm:px-7 pt-20 pb-16">
          <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-8 sm:p-12 shadow-[0_2px_0_var(--ivory-3)]">
            <div className="inline-flex items-center gap-3 text-[11px] tracking-[.32em] uppercase text-navy font-bold mb-3">
              <span className="inline-block w-8 h-0.5 bg-navy" aria-hidden />
              You're in
            </div>
            <h1
              className="font-sans font-bold text-[color:var(--navy-ink)] mt-2 mb-5"
              style={{ fontSize: "clamp(34px, 5vw, 54px)", lineHeight: "1.05", letterSpacing: "-.03em" }}
            >
              Thanks for signing up.
            </h1>
            <p className="text-[17px] leading-[1.55] text-[color:var(--navy-ink)] mb-5 max-w-[56ch]">
              We've got your details. You'll hear from us when we're organizing events
              or have news worth sharing — usually no more than once or twice a month.
            </p>
            <p className="text-[15px] leading-[1.55] text-[color:var(--navy-ink)] mb-6 max-w-[56ch]">
              We've also sent a confirmation to your inbox. Reply to it any time — it reaches
              our team directly.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-block bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold"
              >
                ← Back to the homepage
              </Link>
              <Link
                href="/"
                className="inline-block text-navy border border-navy px-5 py-2.5 rounded text-sm font-semibold hover:bg-navy hover:text-white"
              >
                See the May 1 event
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
