import Image from "next/image";
import { event } from "@/lib/event";

// Fixed-ratio desktop/tablet flyer. Uses container queries (cqw) so it scales
// gracefully from ~700px up to 1200px of container width.
export default function DesktopFlyer() {
  return (
    <div className="flyer-stage w-full max-w-[1080px] mx-auto">
      <div
        className="relative grid overflow-hidden rounded-[1.2cqw] shadow-2xl ring-1 ring-black/5"
        style={{
          aspectRatio: "1080 / 1080",
          gridTemplateRows: "16.6cqw 1fr 14cqw",
          background: "var(--ivory)",
        }}
      >
        {/* Corner marks */}
        <span className="pointer-events-none absolute z-20 top-[1.4cqw] left-[1.4cqw] h-[2.8cqw] w-[2.8cqw] border border-white/70 border-b-0 border-r-0" />
        <span className="pointer-events-none absolute z-20 top-[1.4cqw] right-[1.4cqw] h-[2.8cqw] w-[2.8cqw] border border-white/70 border-b-0 border-l-0" />
        <span className="pointer-events-none absolute z-20 bottom-[1.4cqw] left-[1.4cqw] h-[2.8cqw] w-[2.8cqw] border border-[color:var(--navy)]/40 border-t-0 border-r-0" />
        <span className="pointer-events-none absolute z-20 bottom-[1.4cqw] right-[1.4cqw] h-[2.8cqw] w-[2.8cqw] border border-[color:var(--navy)]/40 border-t-0 border-l-0" />

        {/* HEADER */}
        <header
          className="relative text-white"
          style={{ background: "var(--navy)" }}
        >
          <div className="absolute top-[2cqw] left-[3.2cqw] text-white/90 text-[1.1cqw] tracking-[.22em] font-semibold leading-tight">
            UWC<br />BAY AREA
          </div>
          <div className="absolute top-[2cqw] right-[3.2cqw] text-white/90 text-[1.1cqw] tracking-[.22em] font-semibold leading-tight text-right">
            {event.dayOfWeek}<br />{event.timeLabel}
          </div>
          <div className="absolute top-[1cqw] left-1/2 -translate-x-1/2 text-white/85 text-[1.05cqw] tracking-[.32em] uppercase whitespace-nowrap">
            {event.audienceTag}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-[3.2cqw] text-center">
            <div
              className="display font-semibold italic leading-none"
              style={{ fontSize: "8.5cqw" }}
            >
              {event.dateShort}
            </div>
            <div className="mt-[.6cqw] tracking-[.32em] text-[1.1cqw] font-semibold">{event.city}</div>
            <div className="mt-[.2cqw] tracking-[.22em] text-[.95cqw] text-white/80 underline underline-offset-[.4em]">
              {event.venue}
            </div>
          </div>
        </header>

        {/* BODY */}
        <section className="grid grid-cols-[1.15fr_1fr]">
          {/* LEFT */}
          <div
            className="relative p-[3.2cqw] pr-[2.4cqw] text-white flex flex-col gap-[1.5cqw] justify-center overflow-hidden"
            style={{ background: "#0f3a66" }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-30"
              style={{ backgroundImage: "url(/waterford-bg.jpg)" }}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,58,102,.55) 0%, rgba(15,58,102,.75) 100%)" }} />
            <div className="relative z-10">
              <h1 className="display font-semibold leading-[1.02] text-[3.2cqw]">
                {event.hero.title} <em>{event.hero.titleItalic}</em>
              </h1>
              <p className="mt-[1.5cqw] text-[1.35cqw] leading-snug text-white/90 max-w-[30cqw]">
                {event.hero.body}
              </p>

              <div className="mt-[2.5cqw] flex items-center gap-[2.2cqw]">
                {event.speakers.map((sp) => (
                  <div key={sp.name} className="flex flex-col items-center gap-[.4cqw] text-center">
                    <div
                      className="rounded-full bg-cover bg-center ring-2 ring-white/30"
                      style={{
                        width: "9.5cqw",
                        height: "9.5cqw",
                        backgroundImage: `url(${sp.photo})`,
                      }}
                    />
                    <div className="text-[1.15cqw] font-bold tracking-[.18em] uppercase">{sp.name}</div>
                    <div className="text-[.95cqw] tracking-[.14em] uppercase text-white/70 -mt-[.1cqw]">{sp.role}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div
            className="relative text-white text-center p-[2.4cqw] flex flex-col items-center justify-start gap-[.3cqw]"
            style={{ background: "var(--navy)" }}
          >
            <div className="display italic text-[2cqw] mt-[.3cqw]">{event.featured.eyebrow}</div>
            <div
              className="mt-[.8cqw] rounded-full bg-cover bg-center ring-[3px] ring-white/95 shadow-[0_12px_24px_rgba(0,0,0,.35)]"
              style={{
                width: "17cqw",
                height: "17cqw",
                backgroundImage: `url(${event.featured.photo})`,
                backgroundPosition: "50% 22%",
              }}
            />
            <div className="display font-semibold text-[2.8cqw] mt-[1.2cqw] leading-none">{event.featured.name}</div>
            <div className="text-[1.2cqw] mt-[.6cqw]">{event.featured.role}</div>
            <div className="text-[1.05cqw] text-white/80">{event.featured.org}</div>

            <div
              className="mt-[1cqw] overflow-hidden rounded-[1cqw] flex items-center justify-center"
              style={{ height: "12cqw" }}
            >
              <Image src="/uwc-logo.png" alt="UWC" width={225} height={225} className="h-full w-auto" />
            </div>

            <div className="mt-[1cqw] text-[1.3cqw] tracking-[.18em] uppercase border-t border-white/30 pt-[1cqw] px-[2cqw]">
              <em className="display italic text-[1.7cqw] normal-case tracking-normal">{event.featured.update}</em>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer
          className="grid grid-cols-4 items-start relative text-[color:var(--navy)]"
          style={{ background: "var(--ivory)" }}
        >
          <div className="absolute top-0 inset-x-0 h-[3px]" style={{ background: "linear-gradient(90deg, var(--navy) 0%, var(--navy-2) 50%, var(--navy) 100%)" }} />

          <FCell label="Time" value={event.time} />
          <FCell label="Refreshments" value={event.refreshments} />
          <FCell
            label="Tickets"
            value={
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noreferrer"
                className="link-underline inline-flex items-center gap-[.35em]"
              >
                Click to purchase
                <span aria-hidden>→</span>
              </a>
            }
            sub={`${event.price} · LIMITED CAPACITY`}
          />
          <FCell
            label="Questions?"
            value={
              <a
                href={`mailto:${event.contactEmail}`}
                className="link-underline inline-flex items-center gap-[.35em]"
              >
                Reach out
                <span aria-hidden>→</span>
              </a>
            }
            sub={event.contactEmail.toUpperCase()}
          />
        </footer>
      </div>
    </div>
  );
}

function FCell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center px-[1cqw] pt-[2.2cqw] pb-[2cqw]">
      <div className="text-[.95cqw] tracking-[.22em] uppercase text-[rgba(11,37,69,.55)] font-semibold">{label}</div>
      <div className="display text-[2.3cqw] mt-[.6cqw] leading-tight">{value}</div>
      {sub && (
        <div className="block mt-[1.1em] text-[.95cqw] tracking-[.18em] uppercase text-[rgba(11,37,69,.55)]">
          {sub}
        </div>
      )}
    </div>
  );
}
