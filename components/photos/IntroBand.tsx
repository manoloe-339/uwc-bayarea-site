export default function IntroBand() {
  return (
    <section className="bg-ivory border-b border-[color:var(--rule)] px-7 pt-11 pb-7">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-[11px] tracking-[.32em] uppercase font-bold text-navy mb-3.5">
          Photographs &middot; 1976 &mdash; present
        </div>
        <h1
          className="font-display font-bold text-[color:var(--navy-ink)] m-0 max-w-[980px]"
          style={{
            fontSize: "clamp(40px, 5.6vw, 72px)",
            lineHeight: 1.02,
            letterSpacing: "-.025em",
            textWrap: "balance",
          }}
        >
          A community,{" "}
          <em className="not-italic font-semibold text-navy" style={{ fontStyle: "italic" }}>
            in pictures
          </em>
        </h1>
        <p
          className="font-sans text-[color:var(--muted)] max-w-[640px] mt-4"
          style={{ fontSize: "clamp(15px, 1.3vw, 18px)", lineHeight: 1.55 }}
        >
          Half a century of dinners, firesides, picnics, and weddings — submitted by
          alumni and stitched together here. New galleries appear at the top as
          they&rsquo;re added.
        </p>
      </div>
    </section>
  );
}
