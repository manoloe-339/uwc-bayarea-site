import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events-db";
import { getEventPhotos, getPhotoStats } from "@/lib/event-photos/queries";
import type { ApprovalStatus, PhotoFilter } from "@/lib/event-photos/types";
import {
  PhotoStatsCards,
  PhotoFilterTabs,
  PhotoGrid,
  DownloadButtons,
  PhotoUploadZoneWrapper,
} from "@/components/event-photos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_FILTERS: PhotoFilter[] = ["all", "pending", "approved", "rejected"];

export default async function PhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter: filterParam } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const filter: PhotoFilter = VALID_FILTERS.includes((filterParam ?? "all") as PhotoFilter)
    ? ((filterParam ?? "all") as PhotoFilter)
    : "all";

  const statusForQuery: ApprovalStatus | undefined = filter === "all" ? undefined : filter;
  const [photos, stats] = await Promise.all([
    getEventPhotos(event.id, statusForQuery),
    getPhotoStats(event.id),
  ]);

  const basePath = `/admin/ticket-events/${slug}/photos`;

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link
          href={`/admin/ticket-events/${slug}/attendees`}
          className="text-[color:var(--muted)] hover:text-navy"
        >
          ← {event.name}
        </Link>
      </div>

      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Photos</h1>
          <p className="text-[color:var(--muted)] text-sm">
            {event.name}
            {event.date
              ? ` · ${new Date(event.date).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}`
              : ""}
          </p>
        </div>
        <DownloadButtons eventId={event.id} stats={stats} />
      </div>

      <PhotoStatsCards stats={stats} />

      <PhotoUploadZoneWrapper eventId={event.id} />

      <PhotoFilterTabs active={filter} basePath={basePath} stats={stats} />

      <PhotoGrid photos={photos} eventId={event.id} />
    </div>
  );
}
