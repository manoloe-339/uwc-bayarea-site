import { notFound } from "next/navigation";
import { getEventByUploadToken } from "@/lib/event-photos/queries";
import { AttendeePhotoUploadZone } from "@/components/event-photos/AttendeePhotoUploadZone";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata = {
  title: "Share your photos · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default async function AttendeePhotoUploadPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const event = await getEventByUploadToken(token);

  if (!event || event.slug !== slug) notFound();

  const dateLabel = event.date
    ? new Date(event.date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  if (!event.photo_upload_enabled) {
    return (
      <main className="min-h-screen bg-ivory">
        <div className="max-w-[640px] mx-auto px-5 py-16 text-center">
          <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-2">
            {event.name}
          </h1>
          {dateLabel && (
            <p className="text-[color:var(--muted)] mb-6">{dateLabel}</p>
          )}
          <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-8">
            <p className="text-[color:var(--navy-ink)]">
              Photo uploads are currently closed for this event.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-[640px] mx-auto px-5 py-12">
        <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-1">
          Share your photos
        </h1>
        <p className="text-[color:var(--muted)] mb-1">{event.name}</p>
        {dateLabel && (
          <p className="text-[color:var(--muted)] text-sm mb-8">{dateLabel}</p>
        )}

        <p className="text-sm text-[color:var(--navy-ink)] mb-6">
          Thanks for coming! Drop your photos below and we'll add them to the
          event gallery after a quick review.
        </p>

        <AttendeePhotoUploadZone token={token} />
      </div>
    </main>
  );
}
