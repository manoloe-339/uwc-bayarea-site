import type { Metadata } from "next";
import DirectoryLoginForm from "./DirectoryLoginForm";

export const metadata: Metadata = {
  title: "Directory access · UWC Bay Area",
  description: "Read-only access to the UWC Bay Area alumni directory.",
  robots: { index: false, follow: false },
};

export default async function DirectoryLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next =
    typeof sp.next === "string" && sp.next.startsWith("/directory")
      ? sp.next
      : "/directory";

  return (
    <>
      <section className="max-w-[460px] mx-auto px-5 sm:px-7 pt-20 sm:pt-[120px] pb-20">
        <div className="inline-flex items-center gap-3.5 text-[12px] tracking-[.32em] uppercase text-navy font-bold mb-5">
          <span className="inline-block w-8 h-0.5 bg-navy" aria-hidden />
          Directory access
        </div>
        <h1 className="font-sans font-bold text-[color:var(--navy-ink)] mb-3 text-[36px] leading-[1.06] tracking-[-0.02em]">
          Sign in
        </h1>
        <p className="text-[color:var(--muted)] text-sm leading-[1.55] mb-7">
          Read-only directory for trusted organizers. Lookup &amp; LinkedIn
          links only — no email or phone exposed.
        </p>
        <DirectoryLoginForm next={next} />
      </section>
    </>
  );
}
