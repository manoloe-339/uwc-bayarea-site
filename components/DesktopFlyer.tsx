import { event } from "@/lib/event";
import TicketButton from "./TicketButton";

export default function DesktopFlyer({ seatsRemaining = event.totalSeats }: { seatsRemaining?: number }) {
  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <div
        className="relative overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5"
        style={{ background: "var(--ivory)" }}
      >
        {/* HEADER */}
        <header
          className="relative text-white text-center px-12 pt-10 pb-11"
          style={{ background: "var(--navy)" }}
        >
          <div className="absolute top-5 left-6 text-white/60 text-[11px] tracking-[.22em] font-bold leading-tight">
            UWC
            <br />
            BAY AREA
          </div>
          <div className="absolute top-5 right-6 text-white/60 text-[11px] tracking-[.22em] font-bold leading-tight text-right">
            {event.dayOfWeek}
            <br />
            {event.timeLabel}
          </div>

          <div className="text-[11px] tracking-[.32em] uppercase text-white/85 mb-4">
            {event.audienceTag}
          </div>
          <div
            className="display italic font-semibold leading-none"
            style={{ fontSize: "88px" }}
          >
            {event.dateShort}
          </div>
          <div className="mt-[10px] tracking-[.32em] text-[12px] font-bold">
            {event.city}
          </div>
          <div className="mt-1.5 tracking-[.22em] text-[11px] text-white/80 underline underline-offset-[3px]">
            {event.time}
          </div>
        </header>

        {/* URGENCY RIBBON */}
        <div
          className="text-white text-center py-2.5 px-5 text-[11px] font-bold tracking-[.28em] uppercase flex items-center justify-center gap-[14px]"
          style={{ background: "#B8341F" }}
        >
          <span className="urgency-dot w-2 h-2 rounded-full bg-white inline-block" />
          {event.earlyBirdStatus === "sold_out" ? (
            <>
              Early Bird Sold Out · {event.currentPrice.display} tickets available —{" "}
              <span className="display italic font-semibold text-[14px] tracking-[.02em] normal-case">
                {seatsRemaining <= event.lowSeatsThreshold
                  ? `last chance — only ${seatsRemaining} seats left`
                  : `only ${seatsRemaining} seats remain`}
              </span>
            </>
          ) : (
            <>
              {seatsRemaining <= event.lowSeatsThreshold ? "Last chance —" : "Selling quickly —"}{" "}
              <span className="display italic font-semibold text-[14px] tracking-[.02em] normal-case">
                only {seatsRemaining} seats remain
              </span>
            </>
          )}
        </div>

        {/* TICKET CTA BAND */}
        <div
          className="bg-white flex items-center justify-center gap-7 py-[22px] px-8 border-b border-black/5"
          style={{ color: "var(--navy)" }}
        >
          <div className="display font-bold leading-none text-[40px]">
            {event.currentPrice.display}
          </div>
          <TicketButton
            href={event.ticketUrl}
            className="inline-flex items-center gap-2.5 text-white no-underline rounded-full text-[13px] font-bold tracking-[.2em] uppercase transition hover:brightness-110 active:scale-[.97]"
            style={{ background: "var(--navy)", padding: "16px 32px" }}
          >
            Get tickets
            <span aria-hidden>→</span>
          </TicketButton>
          <div
            className="text-[11px] tracking-[.28em] uppercase font-semibold"
            style={{ color: "rgba(11,37,69,.55)" }}
          >
            {event.priceNote}
          </div>
        </div>

        {/* BODY */}
        <section className="grid grid-cols-[1.15fr_1fr]">
          {/* LEFT */}
          <div
            className="relative px-11 py-10 text-white flex flex-col gap-7 overflow-hidden"
            style={{ background: "#0f3a66" }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(15,58,102,.55), rgba(15,58,102,.88)), url(/waterford-bg.jpg) center/cover",
              }}
            />
            <div className="relative z-10">
              <h1 className="display font-bold leading-[1.05] tracking-[-.01em] text-[42px] m-0">
                {event.hero.title} <em className="font-semibold">{event.hero.titleItalic}</em>
              </h1>
              <p className="mt-5 text-[16px] leading-[1.5] text-white/90 max-w-[38ch]">
                {event.hero.body}
              </p>
            </div>

            <div className="relative z-10 flex gap-[30px] justify-start pl-10">
              {event.speakers.map((sp) => (
                <a
                  key={sp.name}
                  href={sp.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-white no-underline transition hover:opacity-90 hover:-translate-y-0.5"
                >
                  <div
                    className="rounded-full bg-cover bg-center"
                    style={{
                      width: 100,
                      height: 100,
                      backgroundImage: `url(${sp.photo})`,
                      boxShadow:
                        "0 0 0 2px rgba(255,255,255,.8), 0 12px 24px rgba(0,0,0,.3)",
                    }}
                  />
                  <div className="mt-2.5 text-[11px] font-bold tracking-[.18em] uppercase">
                    {sp.name}
                  </div>
                  <div className="text-[10px] tracking-[.14em] uppercase text-white/70 mt-0.5">
                    {sp.role}
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* RIGHT — FIRESIDE */}
          <div
            className="text-white text-center px-8 py-9 flex flex-col items-center gap-2.5 justify-center"
            style={{ background: "var(--navy)" }}
          >
            <div className="display font-bold italic text-[42px] leading-[1.05] tracking-[-.01em] mb-2">
              {event.fireside.eyebrow}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 mt-5 w-full">
              <FiresidePerson speaker={event.fireside.speakers[0]} />
              <div
                className="display italic text-[32px] self-center"
                style={{ color: "rgba(255,255,255,.5)", paddingTop: "48px" }}
              >
                &amp;
              </div>
              <FiresidePerson speaker={event.fireside.speakers[1]} />
            </div>
          </div>
        </section>

        {/* WHERE BAND */}
        <div
          className="relative text-white overflow-hidden py-8 px-11 grid items-center gap-8"
          style={{
            background: "#0f3a66",
            gridTemplateColumns: "1fr 1.4fr auto",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(15,58,102,.88), rgba(15,58,102,.95)), url(/waterford-bg.jpg) center/cover",
            }}
          />
          <div className="relative z-10">
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
            <div className="display font-semibold text-[28px] leading-[1.15] m-0 mb-1">
              {event.venue}
            </div>
            <div className="text-[12px] text-white/70 tracking-[.1em]">
              {event.venueNeighborhood}
            </div>
          </div>
          <div
            className="relative z-10 overflow-hidden rounded-[10px] border border-white/20"
            style={{ height: 130 }}
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
            className="relative z-10 inline-flex items-center gap-2 text-white no-underline rounded-full whitespace-nowrap text-[11px] font-bold tracking-[.22em] uppercase transition hover:bg-white hover:text-[color:var(--navy)]"
            style={{ border: "1.5px solid rgba(255,255,255,.7)", padding: "12px 22px" }}
          >
            Get directions
            <span aria-hidden>→</span>
          </a>
        </div>

        {/* FOOTER */}
        <footer
          className="grid grid-cols-3"
          style={{ background: "var(--ivory)", color: "var(--navy)", borderTop: "4px solid var(--navy)" }}
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
    </div>
  );
}

function FiresidePerson({
  speaker,
}: {
  speaker: {
    name: string;
    role: string;
    org: readonly string[];
    photo: string;
    photoPosition?: string;
    linkedin?: string;
  };
}) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    speaker.linkedin ? (
      <a
        href={speaker.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center text-center text-white no-underline transition hover:opacity-90 hover:-translate-y-0.5"
      >
        {children}
      </a>
    ) : (
      <div className="flex flex-col items-center text-center">{children}</div>
    );

  return (
    <Wrapper>
      <div
        className="rounded-full bg-cover"
        style={{
          width: 130,
          height: 130,
          backgroundImage: `url(${speaker.photo})`,
          backgroundPosition: speaker.photoPosition ?? "center",
          boxShadow: "0 0 0 3px #fff, 0 12px 24px rgba(0,0,0,.3)",
          marginBottom: 12,
        }}
      />
      <div className="display font-bold text-[20px] leading-[1.1] mb-1.5">{speaker.name}</div>
      <div className="text-[11px] leading-[1.4] text-white/70 tracking-[.06em] mb-2">
        {speaker.role}
      </div>
      <div className="display font-semibold text-[14px] leading-[1.3] text-white tracking-[.01em]">
        {speaker.org.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </Wrapper>
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
    <div className="text-center px-5 py-[26px]">
      <div
        className="text-[10px] tracking-[.22em] uppercase font-bold"
        style={{ color: "rgba(11,37,69,.55)" }}
      >
        {label}
      </div>
      <div className="display text-[22px] mt-2 leading-[1.2]">{value}</div>
      {sub && (
        <div
          className="mt-3.5 text-[10px] tracking-[.18em] uppercase"
          style={{ color: "rgba(11,37,69,.55)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
