import Link from "next/link";
import type { GalleryRow } from "@/lib/photo-galleries";

const DATE_OPTS: Intl.DateTimeFormatOptions = { year: "numeric", month: "short" };

function formatDateShort(d: Date): string {
  // "Sep · 2025"
  const parts = new Intl.DateTimeFormat("en-US", DATE_OPTS).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${month} · ${year}`;
}

export default function GalleryRowView({
  gallery,
  isFirst,
  thumbsPerRow,
}: {
  gallery: GalleryRow;
  isFirst: boolean;
  thumbsPerRow: number;
}) {
  const date = gallery.date instanceof Date ? gallery.date : new Date(gallery.date);
  const dateShort = formatDateShort(date);
  const showOverflow = gallery.photoCount > thumbsPerRow;
  const thumbs = gallery.thumbs.slice(0, thumbsPerRow);
  const overflowCount = gallery.photoCount - thumbsPerRow + 1;

  // Tailwind needs static class names; pre-compute the desktop columns.
  const desktopGridClass =
    thumbsPerRow === 3
      ? "sm:grid-cols-3"
      : thumbsPerRow === 5
      ? "sm:grid-cols-5"
      : "sm:grid-cols-4";

  return (
    <article className={`${isFirst ? "" : "border-t border-[color:var(--rule)]"} pt-11 pb-12`}>
      {/* Header row: title + date · location | see-all */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-6 sm:items-end mb-6">
        <div>
          <div className="text-[11px] tracking-[.32em] uppercase font-bold text-navy mb-2.5">
            {dateShort}
            {gallery.location ? <> &middot; {gallery.location}</> : null}
          </div>
          <h2
            className="font-display font-semibold text-[color:var(--navy-ink)] m-0"
            style={{
              fontSize: "clamp(28px, 3.6vw, 40px)",
              lineHeight: 1.1,
              letterSpacing: "-.01em",
              textWrap: "balance",
            }}
          >
            {gallery.title}
          </h2>
        </div>

        <Link
          href={`/events/${gallery.slug}/photos`}
          className="inline-flex items-center gap-2 text-[11px] tracking-[.22em] uppercase font-bold text-navy no-underline border-b-[1.5px] border-navy pb-1 whitespace-nowrap self-start sm:self-end hover:opacity-80"
        >
          See all {gallery.photoCount} photos &rarr;
        </Link>
      </div>

      {/* Thumbnails */}
      <div className={`grid grid-cols-2 ${desktopGridClass} gap-3`}>
        {thumbs.map((t, i) => {
          const isLast = i === thumbs.length - 1;
          const overlay = isLast && showOverflow;
          return (
            <Link
              key={t.id}
              href={`/events/${gallery.slug}/photos`}
              className="group relative block aspect-[4/3] overflow-hidden bg-[color:var(--ivory-2)] transition-transform duration-200 hover:-translate-y-0.5"
              style={{
                boxShadow: "0 2px 0 var(--ivory-3), 0 8px 18px -10px rgba(11,37,69,.18)",
              }}
            >
              <img
                src={t.url}
                alt={t.alt}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: "saturate(.92)" }}
              />
              {overlay && (
                <div
                  className="absolute inset-0 flex items-center justify-center font-display font-semibold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(2,101,168,.78), rgba(11,37,69,.82))",
                    fontSize: 28,
                    letterSpacing: "-.01em",
                  }}
                >
                  +{overflowCount} more
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </article>
  );
}
