import Image from "next/image";
import { event } from "@/lib/event";
import TicketCTA from "./TicketCTA";

// Mobile-first single-column layout. Phone priority.
export default function MobileFlyer() {
  return (
    <div className="w-full max-w-[520px] mx-auto bg-ivory text-[#0b2545]">
      {/* Hero banner */}
      <section className="relative text-white px-6 pt-10 pb-8 text-center" style={{ background: "var(--navy)" }}>
        <div className="text-[11px] tracking-[.28em] uppercase text-white/80">
          {event.audienceTag}
        </div>
        <div className="mt-6 display italic font-semibold leading-none text-[92px]">
          {event.dateShort}
        </div>
        <div className="mt-3 tracking-[.32em] text-[12px] font-semibold">{event.city}</div>
        <a
          href={event.venueMapUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block tracking-[.22em] text-[11px] text-white/80 underline underline-offset-4"
        >
          {event.venue}
        </a>
        <div className="mt-5 flex justify-center gap-6 text-[11px] tracking-[.22em] uppercase text-white/85">
          <span>{event.dayOfWeek}</span>
          <span className="opacity-60">·</span>
          <span>{event.time}</span>
        </div>
      </section>

      {/* Primary CTA */}
      <div className="px-5 pt-5 pb-3">
        <TicketCTA />
      </div>

      {/* Hero title + body */}
      <section
        className="relative px-6 py-10 text-white overflow-hidden"
        style={{ background: "#0f3a66" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: "url(/waterford-bg.jpg)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(15,58,102,.55), rgba(15,58,102,.85))" }}
        />
        <div className="relative">
          <h1 className="display font-semibold leading-[1.05] text-[34px]">
            {event.hero.title} <em>{event.hero.titleItalic}</em>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/90">{event.hero.body}</p>

          <div className="mt-7 grid grid-cols-2 gap-4">
            {event.speakers.map((sp) => (
              <div key={sp.name} className="text-center">
                <div
                  className="mx-auto rounded-full bg-cover bg-center ring-2 ring-white/30"
                  style={{
                    width: 96,
                    height: 96,
                    backgroundImage: `url(${sp.photo})`,
                  }}
                />
                <div className="mt-2 text-[11px] font-bold tracking-[.18em] uppercase">{sp.name}</div>
                <div className="text-[10px] tracking-[.14em] uppercase text-white/70">{sp.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured speaker */}
      <section className="text-white text-center px-6 py-10" style={{ background: "var(--navy)" }}>
        <div className="display italic text-[20px]">{event.featured.eyebrow}</div>
        <div
          className="mx-auto mt-4 rounded-full bg-cover ring-[3px] ring-white/95 shadow-[0_12px_24px_rgba(0,0,0,.35)]"
          style={{
            width: 180,
            height: 180,
            backgroundImage: `url(${event.featured.photo})`,
            backgroundPosition: "50% 22%",
          }}
        />
        <div className="display font-semibold text-[30px] mt-5 leading-none">{event.featured.name}</div>
        <div className="text-[13px] mt-2">{event.featured.role}</div>
        <div className="text-[12px] text-white/80">{event.featured.org}</div>

        <div className="mx-auto mt-5 rounded-xl overflow-hidden" style={{ width: 120, height: 120 }}>
          <Image src="/uwc-logo.png" alt="UWC" width={225} height={225} className="w-full h-full object-cover" />
        </div>

        <div className="mt-5 border-t border-white/30 pt-4">
          <em className="display italic text-[18px]">{event.featured.update}</em>
        </div>
      </section>

      {/* Logistics */}
      <section className="px-5 py-8 bg-ivory">
        <div className="grid grid-cols-2 gap-4">
          <InfoCard label="Time" value={event.time} />
          <InfoCard label="Refreshments" value={event.refreshments} />
          <InfoCard
            label="Price"
            value={event.price}
            sub={event.priceNote.toUpperCase()}
          />
          <InfoCard
            label="Questions?"
            value={
              <a href={`mailto:${event.contactEmail}`} className="underline underline-offset-2">
                Email us
              </a>
            }
            sub={event.contactEmail}
          />
        </div>

        <div className="mt-6">
          <TicketCTA />
        </div>
      </section>

      <footer className="px-5 pt-6 pb-10 text-center text-[11px] tracking-[.18em] uppercase text-[rgba(11,37,69,.55)]">
        UWC Bay Area · {event.city}
      </footer>
    </div>
  );
}

function InfoCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-lg p-4 text-center shadow-sm">
      <div className="text-[10px] tracking-[.22em] uppercase text-[rgba(11,37,69,.55)] font-semibold">
        {label}
      </div>
      <div className="display text-[20px] mt-2 leading-tight text-[color:var(--navy)]">{value}</div>
      {sub && <div className="mt-2 text-[10px] tracking-[.16em] uppercase text-[rgba(11,37,69,.55)]">{sub}</div>}
    </div>
  );
}
