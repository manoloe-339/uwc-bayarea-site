import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events-db";
import { getApprovedPhotosOrdered } from "@/lib/event-photos/queries";
import { PublicGalleryGrid } from "@/components/event-photos/PublicGalleryGrid";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Event photos · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default async function PublicEventPhotosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const photos = await getApprovedPhotosOrdered(event.id);

  const dateLabel = event.date
    ? new Date(event.date).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-[1100px] mx-auto px-5 py-12">
        <h1 className="font-sans text-3xl sm:text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
          {event.name}
        </h1>
        {dateLabel && (
          <p className="text-[color:var(--muted)] text-sm">{dateLabel}</p>
        )}
        {event.location && (
          <p className="text-[color:var(--muted)] text-sm">{event.location}</p>
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
  );
}
