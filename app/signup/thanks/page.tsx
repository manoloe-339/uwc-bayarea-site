import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getSiteSettings, DEFAULT_SIGNUP_THANKS } from "@/lib/settings";
import { renderSimpleMarkdown } from "@/lib/simple-markdown";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default async function SignupThanksPage() {
  const s = await getSiteSettings();
  const eyebrow =
    (s.signup_thanks_eyebrow ?? "").trim() || DEFAULT_SIGNUP_THANKS.eyebrow;
  const headline =
    (s.signup_thanks_headline ?? "").trim() || DEFAULT_SIGNUP_THANKS.headline;
  const bodyMd =
    (s.signup_thanks_body_md ?? "").trim() || DEFAULT_SIGNUP_THANKS.bodyMd;
  const buttonLabel =
    (s.signup_thanks_button_label ?? "").trim() ||
    DEFAULT_SIGNUP_THANKS.buttonLabel;
  const bodyHtml = renderSimpleMarkdown(bodyMd);

  return (
    <>
      <SiteHeader />
      <main className="bg-ivory min-h-[calc(100vh-140px)]">
        <section className="max-w-[720px] mx-auto px-5 sm:px-7 pt-20 pb-16">
          <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-8 sm:p-12 shadow-[0_2px_0_var(--ivory-3)]">
            <div className="inline-flex items-center gap-3 text-[11px] tracking-[.32em] uppercase text-navy font-bold mb-3">
              <span className="inline-block w-8 h-0.5 bg-navy" aria-hidden />
              {eyebrow}
            </div>
            <h1
              className="font-sans font-bold text-[color:var(--navy-ink)] mt-2 mb-5"
              style={{ fontSize: "clamp(34px, 5vw, 54px)", lineHeight: "1.05", letterSpacing: "-.03em" }}
            >
              {headline}
            </h1>
            <div
              className="text-[16px] leading-[1.55] text-[color:var(--navy-ink)] max-w-[56ch] [&_p]:mb-4 [&_p:last-child]:mb-6 [&_a]:text-navy [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-block bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold"
              >
                {buttonLabel}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
