"use client";

import Image from "next/image";
import Link from "next/link";
import type { DistributedPhoto } from "@/lib/event-photos/queries";

export function DistributedPhotoGrid({ photos }: { photos: DistributedPhoto[] }) {
  if (photos.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-sm text-[color:var(--muted)]">
        No archive photos have been distributed to events yet. Run event
        separation above to move dated archive photos into per-date events.
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-[color:var(--muted)] mb-3">
        Photos originally uploaded to Archive that now live in other events.
        Click any tile to open that event&rsquo;s admin page where you can
        approve, star, and curate.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((p) => (
          <Link
            key={p.id}
            href={`/admin/events/${p.current_event_slug}/photos`}
            className="group relative bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden hover:border-navy"
            title={`Now in: ${p.current_event_name}`}
          >
            <div className="relative aspect-square bg-[color:var(--ivory-deep,#f4f1ea)]">
              <Image
                src={p.blob_url}
                alt={p.original_filename ?? `Photo ${p.id}`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                className="object-cover"
              />
            </div>
            <div className="px-2.5 py-2 text-[11px] text-[color:var(--muted)]">
              <div className="text-[10px] tracking-[.1em] uppercase font-semibold text-navy mb-0.5">
                Now in
              </div>
              <div className="text-[color:var(--navy-ink)] font-semibold leading-tight truncate">
                {p.current_event_name}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
