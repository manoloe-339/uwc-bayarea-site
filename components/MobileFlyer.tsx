import { event } from "@/lib/event";
import TicketButton from "./TicketButton";

export default function MobileFlyer({ seatsRemaining = event.totalSeats }: { seatsRemaining?: number }) {
  return (
    <div className="w-full max-w-[520px] mx-auto bg-ivory text-[#0b2545]">
      {/* HEADER */}
      <section
        className="relative text-white px-6 pt-10 pb-8 text-center"
        style={{ background: "var(--navy)" }}
      >
        <div className="text-[11px] tracking-[.28em] uppercase text-white/80">
          {event.audienceTag}
        </div>
        <div className="mt-6 display italic font-semibold leading-none text-[92px]">
          {event.dateShort}
        </div>
        <div className="mt-3 tracking-[.32em] text-[12px] font-semibold">{event.city}</div>
        <div className="mt-1 tracking-[.22em] text-[11px] text-white/80 underline underline-offset-4">
          {event.time}
        </div>
        <div className="mt-4 flex justify-center gap-6 text-[11px] tracking-[.22em] uppercase text-white/80">
          <span>{event.dayOfWeek}</span>
          <span className="opacity-60">·</span>
          <span>{event.timeLabel}</span>
        </div>
      </section>

      {/* URGENCY RIBBON */}
      <div
        className="text-white text-center py-2.5 px-4 text-[10px] font-bold tracking-[.24em] uppercase flex items-center justify-center gap-3"
        style={{ background: "#B8341F" }}
      >
        <span className="urgency-dot w-2 h-2 rounded-full bg-white inline-block shrink-0" />
        <span className="flex flex-col items-center sm:flex-row sm:flex-wrap sm:justify-center sm:items-baseline sm:gap-1.5 leading-tight">
          {event.earlyBirdStatus === "sold_out" ? (
            <>
              <span>Early Bird Sold Out</span>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="display italic font-semibold text-[12px] tracking-[.02em] normal-case leading-tight">
                {seatsRemaining <= event.lowSeatsThreshold
                  ? `last chance — only ${seatsRemaining} seats left`
                  : `only ${seatsRemaining} seats remain`}
              </span>
            </>
          ) : (
            <>
              <span>
                {seatsRemaining <= event.lowSeatsThreshold ? "Last chance" : "Selling quickly"}
              </span>
              <span aria-hidden className="hidden sm:inline">—</span>
              <span className="display italic font-semibold text-[12px] tracking-[.02em] normal-case leading-tight">
                only {seatsRemaining} seats remain
              </span>
            </>
          )}
        </span>
      </div>

      {/* TICKET CTA BAND */}
      <div
        className="bg-white flex flex-wrap items-center justify-center gap-x-5 gap-y-3 py-5 px-5 border-b border-black/5"
        style={{ color: "var(--navy)" }}
      >
        <div className="display font-bold leading-none text-[32px]">
          {event.currentPrice.display}
        </div>
        <TicketButton
          href={event.ticketUrl}
          className="inline-flex items-center gap-2.5 text-white no-underline rounded-full text-[12px] font-bold tracking-[.2em] uppercase transition hover:brightness-110 active:scale-[.97]"
          style={{ background: "var(--navy)", padding: "14px 26px" }}
        >
          Get tickets
          <span aria-hidden>→</span>
        </TicketButton>
        <div
          className="basis-full text-center text-[10px] tracking-[.24em] uppercase font-semibold"
          style={{ color: "rgba(11,37,69,.55)" }}
        >
          {event.priceNote}
        </div>
      </div>

      {/* HERO (title + body + speakers) */}
      <section
        className="relative px-6 py-10 text-white overflow-hidden"
        style={{ background: "#0f3a66" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,58,102,.55), rgba(15,58,102,.88)), url(/waterford-bg.jpg) center/cover",
          }}
        />
        <div className="relative">
          <h1 className="display font-semibold leading-[1.05] text-[34px]">
            {event.hero.title} <em>{event.hero.titleItalic}</em>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/90">
            {event.hero.body}
          </p>

          <div className="mt-7 grid grid-cols-2 gap-4 pl-6">
            {event.speakers.map((sp) => (
              <a
                key={sp.name}
                href={sp.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-white no-underline transition active:opacity-80"
              >
                <div
                  className="mx-auto rounded-full bg-cover bg-center"
                  style={{
                    width: 96,
                    height: 96,
                    backgroundImage: `url(${sp.photo})`,
                    boxShadow:
                      "0 0 0 2px rgba(255,255,255,.8), 0 12px 24px rgba(0,0,0,.3)",
                  }}
                />
                <div className="mt-2 text-[11px] font-bold tracking-[.18em] uppercase">
                  {sp.name}
                </div>
                <div className="text-[10px] tracking-[.14em] uppercase text-white/70">
                  {sp.role}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FIRESIDE */}
      <section
        className="text-white text-center px-6 py-10"
        style={{ background: "var(--navy)" }}
      >
        <div className="display font-bold italic text-[34px] leading-[1.05] tracking-[-.01em]">
          {event.fireside.eyebrow}
        </div>
        <div className="mt-6 flex flex-col items-center gap-8">
          {event.fireside.speakers.map((sp, idx) => (
            <div key={sp.name} className="flex flex-col items-center">
              <a
                href={sp.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center text-white no-underline transition active:opacity-80"
              >
                <div
                  className="rounded-full bg-cover"
                  style={{
                    width: 130,
                    height: 130,
                    backgroundImage: `url(${sp.photo})`,
                    backgroundPosition: sp.photoPosition ?? "center",
                    boxShadow: "0 0 0 3px #fff, 0 12px 24px rgba(0,0,0,.3)",
                  }}
                />
                <div className="display font-bold text-[22px] leading-[1.1] mt-3">
                  {sp.name}
                </div>
                <div className="text-[11px] tracking-[.06em] text-white/70 mt-1.5">
                  {sp.role}
                </div>
                <div className="display font-semibold text-[14px] leading-[1.3] mt-2 text-center">
                  {sp.org.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </a>
              {idx < event.fireside.speakers.length - 1 && (
                <div
                  className="display italic text-[28px] mt-6"
                  style={{ color: "rgba(255,255,255,.5)" }}
                >
                  &amp;
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* WHERE */}
      <section
        className="relative text-white overflow-hidden px-6 py-8"
        style={{ background: "#0f3a66" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,58,102,.88), rgba(15,58,102,.95)), url(/waterford-bg.jpg) center/cover",
          }}
        />
        <div className="relative z-10 space-y-4">
          <div>
            <div className="text-[10px] tracking-[.3em] font-bold uppercase text-white/60 mb-2 flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Where
            </div>
            <div className="display font-semibold text-[24px] leading-[1.15]">
              {event.venue}
            </div>
            <div className="text-[12px] text-white/70 tracking-[.1em] mt-1">
              {event.venueNeighborhood}
            </div>
          </div>
          <div
            className="overflow-hidden rounded-[10px] border border-white/20"
            style={{ height: 160 }}
          >
            <iframe
              loading="lazy"
              src={event.venueEmbedUrl}
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full block border-0"
              style={{ filter: "saturate(.8)" }}
            />
          </div>
          <a
            href={event.venueMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white no-underline rounded-full text-[11px] font-bold tracking-[.22em] uppercase transition hover:bg-white hover:text-[color:var(--navy)]"
            style={{ border: "1.5px solid rgba(255,255,255,.7)", padding: "12px 22px" }}
          >
            Get directions
            <span aria-hidden>→</span>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="grid grid-cols-3"
        style={{
          background: "var(--ivory)",
          color: "var(--navy)",
          borderTop: "4px solid var(--navy)",
        }}
      >
        <FCell label="Time" value={event.time} />
        <FCell label="Refreshments" value={event.refreshments} />
        <FCell
          label="Questions?"
          value={
            <a
              href={`mailto:${event.contactEmail}`}
              className="no-underline"
              style={{
                color: "var(--navy)",
                borderBottom: "1px solid currentColor",
                paddingBottom: "2px",
              }}
            >
              Reach out
            </a>
          }
        />
      </footer>
    </div>
  );
}

function FCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="text-center px-3 py-5">
      <div
        className="text-[9px] tracking-[.2em] uppercase font-bold"
        style={{ color: "rgba(11,37,69,.55)" }}
      >
        {label}
      </div>
      <div className="display text-[15px] mt-2 leading-[1.2] break-words">{value}</div>
      {sub && (
        <div
          className="mt-2 text-[9px] tracking-[.16em] uppercase break-words"
          style={{ color: "rgba(11,37,69,.55)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
