import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Thank you · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default function HelpOutThanksPage() {
  return (
    <>
      <SiteHeader active="help" />
      <main className="bg-ivory min-h-screen">
        <section className="px-7 pt-20 pb-20">
          <div className="max-w-[720px] mx-auto text-center">
            <div
              className="font-bold uppercase mb-4"
              style={{
                fontSize: 11,
                letterSpacing: ".32em",
                color: "var(--navy)",
              }}
            >
              Sent &middot; Thank you
            </div>
            <h1
              className="font-display font-bold text-[color:var(--navy-ink)] m-0"
              style={{
                fontSize: "clamp(40px, 6vw, 72px)",
                lineHeight: 1.02,
                letterSpacing: "-.025em",
                textWrap: "balance",
              }}
            >
              Thank{" "}
              <em
                className="text-navy font-semibold"
                style={{ fontStyle: "italic" }}
              >
                you
              </em>
              .
            </h1>
            <p
              className="font-sans mx-auto"
              style={{
                fontSize: 18,
                lineHeight: 1.55,
                color: "var(--muted)",
                marginTop: 28,
                maxWidth: 560,
              }}
            >
              We received your interest. We&rsquo;ll match you with the right
              person and follow up. If you&rsquo;re a UWC alum and not yet in
              our directory, please sign up so we can stay in touch.
            </p>
            <div
              className="mt-11 inline-flex items-center gap-4 flex-wrap justify-center"
            >
              <Link
                href="/help-out"
                className="font-bold uppercase text-navy border-b border-navy pb-2"
                style={{ fontSize: 12, letterSpacing: ".22em" }}
              >
                &larr; Submit another
              </Link>
              <Link
                href="/signup"
                className="font-bold uppercase text-white"
                style={{
                  background: "var(--navy)",
                  padding: "16px 28px",
                  fontSize: 12,
                  letterSpacing: ".24em",
                }}
              >
                Sign up to the directory &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
