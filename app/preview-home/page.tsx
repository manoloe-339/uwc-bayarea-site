import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getSiteSettings } from "@/lib/settings";
import {
  getUpcomingFoodies,
  getOtherUpcomingGatherings,
  getRecentFoodiesDisplay,
  getAlumniCount,
  type FoodiesUpcoming,
  type FoodiesHost,
  type OtherGathering,
  type RecentEventCover,
  type RecentFoodiesDisplay,
} from "@/lib/homepage";
import { getActiveHeroSlides } from "@/lib/hero-slides";
import { HeroCarousel, type HeroSlide } from "./HeroCarousel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default async function PreviewHomePage() {
  const [settings, foodies, otherGatherings, recentFoodies, alumniCount, heroSlides] =
    await Promise.all([
      getSiteSettings(),
      getUpcomingFoodies(4),
      getOtherUpcomingGatherings(6),
      getRecentFoodiesDisplay(),
      getAlumniCount(),
      getActiveHeroSlides(),
    ]);

  // ResolvedHeroSlide → HeroSlide are interchangeable shapes (same fields).
  const slides: HeroSlide[] = heroSlides.map((s) => ({ ...s }));

  return (
    <div className="bg-[color:var(--ivory)] text-[color:var(--navy-ink)]">
      <SiteHeader active="home" />
      <HeroCarousel slides={slides} />
      <WhatsAppBand
        url={settings.whatsapp_url}
        headline={settings.whatsapp_default_headline ?? "Most of us live on WhatsApp"}
        body="Connect with local alumni. Must be registered in our SF Bay Area mailing list. All Foodie events are coordinated through WhatsApp."
        ctaLabel={settings.whatsapp_default_cta_label ?? "Join the group →"}
      />
      <FoodiesSection meals={foodies} recent={recentFoodies} />
      <OtherGatheringsSection gatherings={otherGatherings} />
      <JoinInterrupt alumniCount={alumniCount} />
      <AlumniNewsSection />
      <SiteFooter />
    </div>
  );
}

/* ─── WhatsApp band ───────────────────────────────────────────── */

function WhatsAppBand({
  url, headline, body, ctaLabel,
}: {
  url: string | null; headline: string; body: string; ctaLabel: string;
}) {
  return (
    <section className="relative bg-navy text-white overflow-hidden px-6 py-9 sm:px-16 sm:py-[52px]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(800px 200px at 80% 50%, rgba(37,211,102,.08), transparent)",
        }}
      />
      <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center sm:items-center gap-5 sm:gap-9 text-center sm:text-left relative">
        <div
          className="rounded-full bg-[#25D366] flex items-center justify-center shrink-0 w-16 h-16 sm:w-[84px] sm:h-[84px]"
          style={{ boxShadow: "0 8px 24px rgba(37,211,102,.35)" }}
        >
          <WhatsAppMark className="w-9 h-9 sm:w-[46px] sm:h-[46px]" />
        </div>
        <div className="flex-1">
          <h2 className="font-serif font-semibold text-white leading-[1.1] tracking-[-0.005em] text-[28px] sm:text-[40px] m-0">
            {headline}
          </h2>
          <p className="mt-3 text-white/80 leading-[1.55] text-[14px] sm:text-base max-w-[580px] sm:mx-0 mx-auto">
            {body}
          </p>
        </div>
        <div className="shrink-0">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-[13px] font-bold tracking-[.2em] uppercase text-white bg-[#25D366] hover:opacity-90"
            >
              <WhatsAppMark className="w-4 h-4" />
              {ctaLabel}
            </a>
          ) : (
            <span className="inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-[13px] font-bold tracking-[.2em] uppercase text-white/70 bg-white/10 cursor-not-allowed">
              No WhatsApp link set
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.42L3 21" />
      <path d="M9 10c.5 2.5 2.5 4.5 5 5l1.5-1.5 2.5 1c-.3 1.4-1.6 2.5-3 2.5-3 0-7-4-7-7 0-1.4 1.1-2.7 2.5-3l1 2.5L9 10z" fill="#fff" stroke="none" />
    </svg>
  );
}

/* ─── Foodies section ─────────────────────────────────────────── */

function FoodiesSection({
  meals, recent,
}: {
  meals: FoodiesUpcoming[]; recent: RecentFoodiesDisplay;
}) {
  const count = meals.length;
  const featured = meals[0];
  const rest = meals.slice(1);

  return (
    <section className="bg-[color:var(--ivory)] px-6 py-14 sm:px-16 sm:py-[88px]">
      <div className="max-w-[1180px] mx-auto">
        <div className="flex justify-between items-end flex-wrap gap-4 mb-8 sm:mb-10">
          <div>
            <Eyebrow>{count === 0 ? "Foodies" : "Foodies · upcoming meals"}</Eyebrow>
            <h2 className="mt-2.5 font-serif font-semibold leading-[1.04] tracking-[-0.01em] text-[color:var(--navy-ink)] text-[38px] sm:text-[56px]">
              {count === 1 ? (
                <>The next <em className="italic">meal</em></>
              ) : (
                <>Around the <em className="italic">Bay</em></>
              )}
            </h2>
            <p className="mt-3 text-[14px] sm:text-[15px] leading-[1.5] text-[color:var(--muted)] max-w-[560px]">
              {count === 0
                ? "No Foodies meals on the calendar right now — check back soon, or join the WhatsApp group to hear about them first."
                : count === 1
                  ? "Small alumni-hosted dinner. Hosts rotate, all are welcome."
                  : `${count} alumni-hosted meal${count === 1 ? "" : "s"} on the calendar. Hosts rotate · all are welcome.`}
            </p>
          </div>
        </div>

        {/* Cards */}
        {count === 4 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {meals.map((m) => (
              <FoodiesCard key={m.id} meal={m} featured={false} />
            ))}
          </div>
        ) : count === 1 ? (
          <FoodiesCard meal={featured} featured />
        ) : count > 0 ? (
          <div
            className="grid grid-cols-1 gap-4 sm:gap-5 items-stretch sm:[grid-template-columns:1.4fr_1fr]"
          >
            <FoodiesCard meal={featured} featured />
            {rest.length > 0 && (
              <div
                className="grid gap-4 sm:gap-5"
                style={{ gridTemplateRows: rest.length > 1 ? "1fr 1fr" : "1fr" }}
              >
                {rest.map((m) => (
                  <FoodiesCard key={m.id} meal={m} featured={false} />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Recent Foodies row — adapts when only one past Foodies has photos */}
        {recent.mode !== "empty" && <RecentFoodiesRow recent={recent} />}
      </div>
    </section>
  );
}

function FoodiesCard({ meal, featured }: { meal: FoodiesUpcoming; featured: boolean }) {
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <article
      className={`bg-white border border-[color:var(--rule)] border-t-[3px] border-t-navy flex flex-col ${
        featured ? "p-6 sm:p-7" : "p-5"
      }`}
      style={{ boxShadow: "0 2px 0 #E7DFC8, 0 24px 60px -30px rgba(11,37,69,.18)" }}
    >
      {meal.region && (
        <div className="mb-3.5">
          <span className="px-2.5 py-1 border border-[color:var(--rule)] text-[9.5px] font-bold tracking-[.22em] uppercase text-navy bg-[color:var(--ivory)]">
            {meal.region}
          </span>
        </div>
      )}
      <h3
        className={`font-serif font-semibold leading-[1.08] tracking-[-0.005em] text-[color:var(--navy-ink)] m-0 ${
          featured ? "text-[30px] sm:text-[38px]" : "text-[22px] sm:text-[24px]"
        }`}
      >
        {meal.name}
      </h3>
      <div className={`mt-1.5 text-[color:var(--muted)] ${featured ? "text-[14px]" : "text-[13px]"}`}>
        {[meal.cuisine, meal.neighborhood].filter(Boolean).join(" · ")}
      </div>

      {(meal.host_1 || meal.host_2) && (
        <div className={`flex items-center gap-2.5 flex-wrap ${featured ? "mt-4" : "mt-3.5"}`}>
          <HostAvatars host1={meal.host_1} host2={meal.host_2} featured={featured} />
          <div className={`leading-[1.4] text-[color:var(--navy-ink)] ${featured ? "text-[13px]" : "text-[12px]"}`}>
            <span className="text-[color:var(--muted)] font-medium">Hosted by </span>
            {meal.host_1 && <span className="font-semibold">{hostDisplay(meal.host_1)}</span>}
            {meal.host_1 && meal.host_2 && <span className="text-[color:var(--muted)]"> &amp; </span>}
            {meal.host_2 && <span className="font-semibold">{hostDisplay(meal.host_2)}</span>}
          </div>
        </div>
      )}

      <div className={`h-px bg-[color:var(--rule)] ${featured ? "my-4" : "my-3.5"}`} />

      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <div
            className={`font-serif font-semibold text-[color:var(--navy-ink)] leading-none ${
              featured ? "text-[22px]" : "text-[18px]"
            }`}
          >
            {fmtDate(meal.date)}
          </div>
          {meal.time && (
            <div className="mt-1 text-[11px] font-semibold tracking-[.14em] uppercase text-[color:var(--muted)]">
              {meal.time}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function HostAvatars({
  host1, host2, featured,
}: {
  host1: FoodiesHost | null; host2: FoodiesHost | null; featured: boolean;
}) {
  const size = featured ? 28 : 24;
  return (
    <div className="flex items-center">
      {[host1, host2].map((h, i) =>
        h ? (
          <HostAvatar key={i} host={h} sizePx={size} firstInRow={i === 0} />
        ) : null
      )}
    </div>
  );
}

function HostAvatar({
  host, sizePx, firstInRow,
}: {
  host: FoodiesHost; sizePx: number; firstInRow: boolean;
}) {
  const initial = (host.first_name?.[0] ?? host.last_name?.[0] ?? "?").toUpperCase();
  const stackOffset = firstInRow ? 0 : -8;
  return (
    <div
      className="relative rounded-full border-2 border-white bg-[color:var(--ivory-2)] overflow-hidden flex items-center justify-center text-[color:var(--navy)] text-[10px] font-bold"
      style={{ width: sizePx, height: sizePx, marginLeft: stackOffset }}
      title={hostDisplay(host)}
    >
      {host.photo_url ? (
        <Image
          src={host.photo_url}
          alt=""
          fill
          sizes="32px"
          className="object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function hostDisplay(host: FoodiesHost): string {
  const name = host.first_name ?? host.last_name ?? "Host";
  if (host.grad_year && host.grad_year >= 1900) {
    const yy = String(host.grad_year % 100).padStart(2, "0");
    return `${name} '${yy}`;
  }
  return name;
}

function RecentFoodiesRow({ recent }: { recent: RecentFoodiesDisplay }) {
  if (recent.mode === "empty") return null;
  if (recent.mode === "one_per_event") {
    return (
      <div className="mt-12 sm:mt-[72px]">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
          <Eyebrow muted>Recent Foodies · past meals</Eyebrow>
          <Link
            href="/photos"
            className="text-[11px] font-bold tracking-[.22em] uppercase text-navy hover:underline"
          >
            See more photos →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
          {recent.events.map((e) => (
            <RecentEventThumb key={e.id} event={e} />
          ))}
        </div>
      </div>
    );
  }
  // photos_from_latest — single most recent past Foodies, up to 4 photos.
  return (
    <div className="mt-12 sm:mt-[72px]">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
        <Eyebrow muted>From our last meal · {recent.event.name}</Eyebrow>
        <Link
          href={`/events/${recent.event.slug}/photos`}
          className="text-[11px] font-bold tracking-[.22em] uppercase text-navy hover:underline"
        >
          See more photos →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        {recent.photos.map((p) => (
          <Link
            key={p.id}
            href={`/events/${recent.event.slug}/photos`}
            className="relative block aspect-square bg-[color:var(--ivory-2)] overflow-hidden group"
          >
            <Image
              src={p.url}
              alt=""
              fill
              sizes="(min-width: 640px) 290px, 50vw"
              className="object-cover group-hover:opacity-95"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

function RecentEventThumb({ event }: { event: RecentEventCover }) {
  return (
    <Link href={`/events/${event.slug}/photos`} className="block group">
      <div className="relative aspect-square bg-[color:var(--ivory-2)] overflow-hidden">
        {event.cover_url ? (
          <Image
            src={event.cover_url}
            alt=""
            fill
            sizes="(min-width: 640px) 290px, 50vw"
            className="object-cover group-hover:opacity-95"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent 0 14px, rgba(11,37,69,.05) 14px 28px)",
            }}
          />
        )}
      </div>
      <figcaption className="mt-2 text-[12px] font-medium text-[color:var(--navy-ink)]">
        {event.name}
      </figcaption>
      <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">
        {event.location ?? ""}
      </div>
    </Link>
  );
}

/* ─── Other gatherings ────────────────────────────────────────── */

function OtherGatheringsSection({ gatherings }: { gatherings: OtherGathering[] }) {
  if (gatherings.length === 0) return null;
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtDay = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", { weekday: "short" });
  return (
    <section className="bg-[color:var(--ivory)] px-6 pb-14 pt-3 sm:px-16 sm:pt-6 sm:pb-24">
      <div className="max-w-[1180px] mx-auto">
        <div className="border-t border-[color:var(--rule)] pt-8 sm:pt-12 flex justify-between items-end flex-wrap gap-4 mb-6">
          <div>
            <Eyebrow>Other gatherings</Eyebrow>
            <h2 className="mt-2.5 font-serif font-semibold leading-[1.1] text-[color:var(--navy-ink)] text-[28px] sm:text-[38px]">
              Beyond <em className="italic">the table</em>
            </h2>
          </div>
        </div>

        <div>
          {gatherings.map((e, i) => (
            <Link
              key={e.id}
              href={`/events/${e.slug}`}
              className="grid items-center py-5 sm:py-7 gap-4 sm:gap-7 grid-cols-[76px_1fr] sm:grid-cols-[130px_1fr_auto] hover:bg-[color:var(--ivory-2)]/40 -mx-3 sm:-mx-4 px-3 sm:px-4 rounded transition-colors"
              style={{
                borderTop: i === 0 ? undefined : `1px solid var(--rule)`,
              }}
            >
              <div>
                <div className="font-serif font-semibold italic text-[color:var(--navy-ink)] leading-none text-[26px] sm:text-[36px]">
                  {fmtDate(e.date)}
                </div>
                <div className="mt-1.5 text-[10px] font-bold tracking-[.22em] uppercase text-[color:var(--muted)]">
                  {fmtDay(e.date)}
                  {e.time ? ` · ${e.time}` : ""}
                </div>
              </div>
              <div>
                <div className="font-serif font-semibold leading-[1.2] text-[color:var(--navy-ink)] text-[18px] sm:text-[22px]">
                  {e.name}
                </div>
                {e.location && (
                  <div className="mt-1.5 text-[13px] text-[color:var(--muted)]">
                    {e.location}
                  </div>
                )}
              </div>
              <span className="hidden sm:inline text-[11px] font-bold tracking-[.22em] uppercase text-navy">
                Details →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Join interrupt ──────────────────────────────────────────── */

function JoinInterrupt({ alumniCount }: { alumniCount: number }) {
  // Round down to nearest 50 for "over X" framing.
  const rounded = Math.max(50, Math.floor(alumniCount / 50) * 50);
  return (
    <section
      className="bg-[color:var(--navy-deep)] text-white text-center relative overflow-hidden px-6 py-14 sm:px-16 sm:py-[88px]"
    >
      <div className="w-16 h-px bg-white/40 mx-auto mb-6" />
      <Eyebrow color="rgba(255,255,255,.7)">Member sign-up · 2026</Eyebrow>
      <h2 className="mt-3.5 font-serif font-semibold text-white leading-[1.04] tracking-[-0.01em] text-balance text-[36px] sm:text-[64px]">
        Join <em className="italic font-semibold">UWC Bay Area</em>
      </h2>
      <p className="mx-auto mt-5 sm:mt-6 leading-[1.55] text-white/80 max-w-[640px] text-[15px] sm:text-[18px] text-pretty">
        Over <strong className="text-white font-semibold">{rounded}+ alumni</strong> from
        all <strong className="text-white font-semibold">18 UWC colleges</strong>, across{" "}
        <strong className="text-white font-semibold">50 years</strong>{" "}
        <span className="font-serif italic">(1976–2026)</span>.
        We'd love for you to be one of them.
      </p>
      <div className="mt-8 flex gap-3 justify-center flex-wrap">
        <Link
          href="/signup"
          className="inline-flex items-center rounded-full px-7 py-4 text-[13px] font-bold tracking-[.2em] uppercase bg-white text-navy hover:bg-white/90"
        >
          Sign up →
        </Link>
        <a
          href="https://www.uwc.org"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full px-7 py-4 text-[13px] font-bold tracking-[.2em] uppercase bg-transparent text-white border border-white/40 hover:border-white"
        >
          What is UWC?
        </a>
      </div>
    </section>
  );
}

/* ─── Alumni in the news (placeholder) ────────────────────────── */

function AlumniNewsSection() {
  // Phase 1: hardcoded placeholder. Phase 2: news_features table + admin.
  return (
    <section className="bg-white px-6 py-14 sm:px-16 sm:py-24">
      <div className="max-w-[1080px] mx-auto">
        <div className="mb-8 sm:mb-12">
          <Eyebrow>Alumni in the news</Eyebrow>
          <h2 className="mt-2.5 font-serif font-semibold leading-[1.04] tracking-[-0.01em] text-[color:var(--navy-ink)] text-[32px] sm:text-[48px]">
            Out in the <em className="italic">world</em>
          </h2>
        </div>
        <div
          className="border border-dashed border-[color:var(--rule)] rounded-md p-8 sm:p-12 text-center text-[color:var(--muted)] text-sm"
        >
          Alumni features will appear here once the editorial table + admin tooling lands.
        </div>
      </div>
    </section>
  );
}

/* ─── Shared bits ─────────────────────────────────────────────── */

function Eyebrow({
  children, color, muted,
}: {
  children: React.ReactNode; color?: string; muted?: boolean;
}) {
  return (
    <div
      className="text-[11px] font-bold tracking-[.28em] uppercase"
      style={{ color: color ?? (muted ? "var(--muted)" : "var(--navy)") }}
    >
      {children}
    </div>
  );
}
