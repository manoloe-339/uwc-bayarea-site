import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PageviewBeacon from "@/components/analytics/PageviewBeacon";
import { signup } from "@/lib/signup";

export const metadata: Metadata = {
  title: "Sign up · UWC Bay Area",
  description: signup.lede,
};

export default function SignupPage() {
  return (
    <>
      <PageviewBeacon path="/signup" />
      <SiteHeader active="signup" />

      <section className="max-w-[1040px] mx-auto px-5 sm:px-7 pt-14 sm:pt-[88px] pb-10">
        <div className="inline-flex items-center gap-3.5 text-[12px] tracking-[.32em] uppercase text-navy font-bold">
          <span className="inline-block w-8 h-0.5 bg-navy" aria-hidden />
          {signup.kicker}
        </div>

        <h1
          className="font-sans font-bold text-[color:var(--navy-ink)] my-[18px] max-w-[16ch] text-balance leading-[1.02] tracking-[-.035em]"
          style={{ fontSize: "clamp(42px, 6.4vw, 80px)" }}
        >
          {signup.headlinePrefix}{" "}
          <em className="not-italic font-semibold text-navy">{signup.headlineEm}</em>
        </h1>

        <p
          className="text-[color:var(--navy-ink)] leading-[1.55] max-w-[58ch] mb-2.5 text-pretty"
          style={{ fontSize: "clamp(17px, 1.5vw, 20px)" }}
        >
          {signup.lede}
        </p>

        <div className="mt-3 p-4 sm:p-[18px_22px] bg-ivory-2 border-l-[3px] border-navy max-w-[58ch] text-[15px] text-[color:var(--navy-ink)] rounded-[2px]">
          {signup.notes.map((n) => (
            <div key={n.label} className="flex items-start gap-2.5 py-[3px]">
              <span className="text-[11px] tracking-[.22em] uppercase font-bold text-navy min-w-[64px] pt-[3px]">
                {n.label}
              </span>
              <span>
                {n.strong ? (
                  <NoteBody body={n.body} strong={n.strong} />
                ) : (
                  n.body
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="max-w-[1040px] mx-auto mt-5 px-5 sm:px-7">
        <div className="h-px bg-[color:var(--rule)]" />
      </div>

      <section className="max-w-[1040px] mx-auto px-5 sm:px-7 pt-9 pb-20">
        <div className="flex flex-wrap items-baseline justify-between gap-6 mb-[18px]">
          <div className="text-[11px] tracking-[.28em] uppercase font-bold text-[color:var(--muted)]">
            {signup.formEyebrow}
          </div>
          <div className="text-[13px] italic text-[color:var(--muted)]">{signup.formTip}</div>
        </div>

        <div
          className="relative bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden
            shadow-[0_2px_0_var(--ivory-3),0_24px_60px_-30px_rgba(11,37,69,.22)]
            before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-1
            before:bg-[linear-gradient(90deg,var(--navy)_0%,var(--navy-2)_100%)] before:z-[2]"
        >
          <iframe
            src={signup.formEmbedUrl}
            title="UWC Bay Area member sign-up form"
            loading="lazy"
            allow="clipboard-write"
            referrerPolicy="no-referrer-when-downgrade"
            className="block w-full border-0 bg-white"
            style={{ height: signup.formHeight }}
          >
            Loading…
          </iframe>
        </div>

        <p className="mt-[18px] text-center text-sm text-[color:var(--muted)]">
          {signup.fallbackText}{" "}
          <a
            href={signup.formDirectUrl}
            target="_blank"
            rel="noreferrer"
            className="text-navy font-semibold no-underline border-b border-navy hover:bg-navy hover:text-white"
          >
            {signup.fallbackLinkText}
          </a>
        </p>
      </section>

      <SiteFooter />
    </>
  );
}

function NoteBody({ body, strong }: { body: string; strong: string }) {
  const idx = body.indexOf(strong);
  if (idx === -1) return <>{body}</>;
  return (
    <>
      {body.slice(0, idx)}
      <strong className="font-semibold text-[color:var(--navy-2)]">{strong}</strong>
      {body.slice(idx + strong.length)}
    </>
  );
}
