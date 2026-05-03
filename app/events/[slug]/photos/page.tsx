import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events-db";
import { getEventFeaturedAlumni } from "@/lib/event-featured-alumni";
import { getApprovedPhotosOrdered } from "@/lib/event-photos/queries";
import { PublicGalleryGrid } from "@/components/event-photos/PublicGalleryGrid";
import { EventFeaturedAlumni } from "@/components/event-photos/EventFeaturedAlumni";
import { renderSimpleMarkdown } from "@/lib/simple-markdown";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

function formatEventDate(d: unknown): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Per-event social preview metadata (OpenGraph + Twitter Card).
 * Drives the rich preview cards in WhatsApp, iMessage, LinkedIn,
 * Slack, etc. when the URL is shared. Title bakes in "· UWC Bay
 * Area" so the brand surfaces even on minimal renderers (iMessage
 * shows just the domain otherwise). Image is the top approved photo
 * from the gallery (marquee-tagged photos rank first per
 * getApprovedPhotosOrdered's existing ordering). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return {
      title: "Event photos · UWC Bay Area",
      robots: { index: false, follow: false },
    };
  }
  const photos = await getApprovedPhotosOrdered(event.id);
  const topPhotoUrl = photos[0]?.blob_url ?? null;
  const dateLabel = formatEventDate(event.date);
  const title = `${event.name} · UWC Bay Area`;
  const description = dateLabel || "Photos from a UWC Bay Area gathering";
  const images = topPhotoUrl ? [{ url: topPhotoUrl }] : undefined;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      siteName: "UWC Bay Area",
      type: "article",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: topPhotoUrl ? [topPhotoUrl] : undefined,
    },
  };
}

export default async function PublicEventPhotosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const [photos, featured] = await Promise.all([
    getApprovedPhotosOrdered(event.id),
    getEventFeaturedAlumni(event.id),
  ]);

  const dateLabel = event.date
    ? new Date(event.date).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <>
      <SiteHeader />
      <main className="bg-ivory">
        <div className="max-w-[1100px] mx-auto px-5 py-12">
          <h1 className="font-sans text-3xl sm:text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
            {event.name}
          </h1>
          {dateLabel && (
            <p className="text-[color:var(--muted)] text-sm">{dateLabel}</p>
          )}

          <EventFeaturedAlumni featured={featured} />

          {event.gallery_description_md && (
            <div
              className="mt-5 text-[15px] sm:text-base leading-[1.6] text-[color:var(--navy-ink)] [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-navy"
              dangerouslySetInnerHTML={{
                __html: renderSimpleMarkdown(event.gallery_description_md),
              }}
            />
          )}

          <div className="mt-6" />

          {photos.length === 0 ? (
            <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)]">
              Photos from this event will be shared here soon.
            </div>
          ) : (
            <PublicGalleryGrid photos={photos} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
