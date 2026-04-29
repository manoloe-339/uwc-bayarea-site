import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events-db";
import {
  getEventPhotosForTab,
  getPhotoStats,
  getApprovedPhotosOrdered,
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
} from "@/components/event-photos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://uwcbayarea.org").replace(/\/+$/, "");

const VALID_FILTERS: PhotoFilter[] = ["all", "pending", "approved", "rejected", "duplicates"];
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

  const [photos, stats, approvedOrdered] = await Promise.all([
    view === "approve" ? getEventPhotosForTab(event.id, filter) : Promise.resolve([]),
    getPhotoStats(event.id),
    view === "layout" ? getApprovedPhotosOrdered(event.id) : Promise.resolve([]),
  ]);

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
          <PhotoStatsCards stats={stats} />
          <PhotoUploadZoneWrapper eventId={event.id} />
          {event.slug === "archive" && <SeparateArchiveButton />}
          <PhotoFilterTabs active={filter} basePath={basePath} stats={stats} />
          <PhotoGrid photos={photos} eventId={event.id} />
        </>
      ) : (
        <GalleryLayoutEditor photos={approvedOrdered} eventId={event.id} />
      )}
    </div>
  );
}
