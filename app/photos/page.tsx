import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import IntroBand from "@/components/photos/IntroBand";
import MarqueeStrip from "@/components/photos/MarqueeStrip";
import GalleryRowView from "@/components/photos/GalleryRow";
import { getSiteSettings } from "@/lib/settings";
import { getPublicGalleryRows, getMarqueePool } from "@/lib/photo-galleries";
import {
  getMockGalleryRows,
  getMockMarqueePool,
} from "@/lib/photo-galleries-mock";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Photo Galleries · UWC Bay Area",
  description:
    "Photographs from UWC Bay Area gatherings — dinners, firesides, picnics, and more.",
};

export default async function PhotosPage() {
  const settings = await getSiteSettings();
  const thumbsPerRow = settings.photo_gallery_thumbs_per_row;

  const realGalleries = await getPublicGalleryRows(thumbsPerRow);
  const realMarquee = await getMarqueePool();

  // Fall back to mock placeholders only when there is no real data yet.
  const galleries = realGalleries.length > 0 ? realGalleries : getMockGalleryRows(thumbsPerRow);
  const marquee = realMarquee.length > 0 ? realMarquee : getMockMarqueePool();
  const usingMocks = realGalleries.length === 0;

  return (
    <>
      <SiteHeader active="photos" />
      <main className="bg-ivory">
        {settings.photo_gallery_show_intro && <IntroBand />}

        <MarqueeStrip
          photos={marquee}
          paused={settings.photo_gallery_marquee_paused}
          slideDurationSec={settings.photo_gallery_slide_duration_sec}
        />

        <section className="bg-ivory px-7 pt-7 pb-16">
          <div className="max-w-[1200px] mx-auto">
            {/* Section heading */}
            <div className="flex items-baseline justify-between gap-3 flex-wrap pt-8 pb-2 border-b border-[color:var(--rule)] mb-2">
              <div>
                <div className="text-[11px] tracking-[.32em] uppercase font-bold text-navy mb-2">
                  Recent gatherings
                </div>
                <h2
                  className="font-display font-semibold text-[color:var(--navy-ink)] m-0"
                  style={{
                    fontSize: "clamp(24px, 2.6vw, 32px)",
                    lineHeight: 1.1,
                    letterSpacing: "-.01em",
                  }}
                >
                  Newest first{" "}
                  <em
                    className="font-semibold"
                    style={{
                      fontStyle: "italic",
                      color: "var(--muted-2)",
                      fontSize: "0.7em",
                    }}
                  >
                    &middot; {galleries.length} galler{galleries.length === 1 ? "y" : "ies"}
                  </em>
                </h2>
              </div>
              {usingMocks && (
                <div className="text-[11px] tracking-[.18em] uppercase font-semibold text-[color:var(--muted)]">
                  Showing example data — backfill events to populate
                </div>
              )}
            </div>

            {galleries.length === 0 ? (
              <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] mt-6">
                Photo galleries from past events will appear here.
              </div>
            ) : (
              galleries.map((g, i) => (
                <GalleryRowView
                  key={`${g.eventId}-${g.slug}`}
                  gallery={g}
                  isFirst={i === 0}
                  thumbsPerRow={thumbsPerRow}
                />
              ))
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
