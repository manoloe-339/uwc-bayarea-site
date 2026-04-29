import { DEFAULT_PHOTO_GALLERY_INTRO } from "@/lib/settings";

export default function IntroBand({
  eyebrow,
  headline,
  headlineAccent,
  subhead,
}: {
  eyebrow: string | null;
  headline: string | null;
  headlineAccent: string | null;
  subhead: string | null;
}) {
  const e = (eyebrow ?? DEFAULT_PHOTO_GALLERY_INTRO.eyebrow).trim();
  const h = (headline ?? DEFAULT_PHOTO_GALLERY_INTRO.headline).trim();
  const ha = (headlineAccent ?? DEFAULT_PHOTO_GALLERY_INTRO.headlineAccent).trim();
  const s = (subhead ?? DEFAULT_PHOTO_GALLERY_INTRO.subhead).trim();

  return (
    <section className="bg-ivory border-b border-[color:var(--rule)] px-7 pt-11 pb-7">
      <div className="max-w-[1200px] mx-auto">
        {e && (
          <div className="text-[11px] tracking-[.32em] uppercase font-bold text-navy mb-3.5">
            {e}
          </div>
        )}
        <h1
          className="font-display font-bold text-[color:var(--navy-ink)] m-0 max-w-[980px]"
          style={{
            fontSize: "clamp(40px, 5.6vw, 72px)",
            lineHeight: 1.02,
            letterSpacing: "-.025em",
            textWrap: "balance",
          }}
        >
          {h}
          {h && ha ? " " : ""}
          {ha && (
            <em className="font-semibold text-navy" style={{ fontStyle: "italic" }}>
              {ha}
            </em>
          )}
        </h1>
        {s && (
          <p
            className="font-sans text-[color:var(--muted)] max-w-[640px] mt-4"
            style={{ fontSize: "clamp(15px, 1.3vw, 18px)", lineHeight: 1.55 }}
          >
            {s}
          </p>
        )}
      </div>
    </section>
  );
}
