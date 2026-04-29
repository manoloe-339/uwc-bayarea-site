import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug, listEvents } from "@/lib/events-db";
import {
  getEventPhotosForTab,
  getPhotoStats,
  getApprovedPhotosOrdered,
  getDistributedArchivePhotos,
} from "@/lib/event-photos/queries";
import type { PhotoFilter } from "@/lib/event-photos/types";
import {
  PhotoStatsCards,
  PhotoFilterTabs,
  PhotoGrid,
  DownloadButtons,
  PhotoUploadZoneWrapper,
  GalleryLayoutEditor,
  PhotoUploadLinkSection,
  SeparateArchiveButton,
  DistributedPhotoGrid,
} from "@/components/event-photos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://uwcbayarea.org").replace(/\/+$/, "");

const VALID_FILTERS: PhotoFilter[] = ["all", "pending", "approved", "rejected", "duplicates", "distributed"];
type View = "approve" | "layout";

export default async function PhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string; view?: string }>;
}) {
  const { slug } = await params;
  const { filter: filterParam, view: viewParam } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const view: View = viewParam === "layout" ? "layout" : "approve";

  const filter: PhotoFilter = VALID_FILTERS.includes((filterParam ?? "all") as PhotoFilter)
    ? ((filterParam ?? "all") as PhotoFilter)
    : "all";

  const isArchive = event.slug === "archive";
  const [photos, stats, approvedOrdered, distributedPhotos, allEvents] = await Promise.all([
    view === "approve" && filter !== "distributed"
      ? getEventPhotosForTab(event.id, filter)
      : Promise.resolve([]),
    getPhotoStats(event.id, event.slug),
    view === "layout" ? getApprovedPhotosOrdered(event.id) : Promise.resolve([]),
    view === "approve" && filter === "distributed" && isArchive
      ? getDistributedArchivePhotos(event.id)
      : Promise.resolve([]),
    isArchive ? listEvents() : Promise.resolve([]),
  ]);

  // The lightbox dropdown only needs other events (skip archive itself
  // and the current event), as a lightweight slug/name/date list.
  const assignableEvents = allEvents
    .filter((e) => e.id !== event.id && e.slug !== "archive")
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      date: e.date instanceof Date ? e.date.toISOString() : (e.date as unknown as string),
    }));

  const basePath = `/admin/events/${slug}/photos`;

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link
          href={`/admin/events/${slug}/attendees`}
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
        {view === "approve" && <DownloadButtons eventId={event.id} stats={stats} />}
      </div>

      <PhotoUploadLinkSection
        eventId={event.id}
        eventSlug={slug}
        eventName={event.name}
        initialToken={event.photo_upload_token}
        initialEnabled={event.photo_upload_enabled}
        appUrl={APP_URL}
      />

      <div className="flex items-center gap-1 border-b border-[color:var(--rule)] mb-6">
        <Link
          href={basePath}
          className={`px-4 py-2 text-sm border-b-2 -mb-px ${
            view === "approve"
              ? "border-navy text-navy font-semibold"
              : "border-transparent text-[color:var(--muted)] hover:text-navy"
          }`}
        >
          Approve
        </Link>
        <Link
          href={`${basePath}?view=layout`}
          className={`px-4 py-2 text-sm border-b-2 -mb-px ${
            view === "layout"
              ? "border-navy text-navy font-semibold"
              : "border-transparent text-[color:var(--muted)] hover:text-navy"
          }`}
        >
          Gallery layout
          <span className="ml-1.5 text-[11px] text-[color:var(--muted)]">({stats.approved})</span>
        </Link>
      </div>

      {view === "approve" ? (
        <>
          <PhotoStatsCards stats={stats} showDistributed={isArchive} />
          <PhotoUploadZoneWrapper eventId={event.id} />
          {isArchive && <SeparateArchiveButton />}
          <PhotoFilterTabs
            active={filter}
            basePath={basePath}
            stats={stats}
            showDistributed={isArchive}
          />
          {filter === "distributed" && isArchive ? (
            <DistributedPhotoGrid photos={distributedPhotos} />
          ) : (
            <PhotoGrid
              photos={photos}
              eventId={event.id}
              assignableEvents={isArchive ? assignableEvents : undefined}
            />
          )}
        </>
      ) : (
        <GalleryLayoutEditor photos={approvedOrdered} eventId={event.id} />
      )}
    </div>
  );
}
