"use client";
import { useState } from "react";
import type { EventPhoto } from "@/lib/event-photos/types";
import { PhotoLightbox } from "./PhotoLightbox";

function marqueeGridCols(count: number): string {
  if (count === 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
}

function marqueeAspect(count: number): string {
  if (count === 1) return "aspect-[16/9]";
  return "aspect-[4/3]";
}

export function PublicGalleryGrid({ photos }: { photos: EventPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const marquee = photos.filter((p) => p.display_role === "marquee");
  const supporting = photos.filter((p) => p.display_role !== "marquee");

  // Lightbox iterates marquee then supporting in display order — same as `photos`.
  const openAt = (i: number) => setLightboxIndex(i);

  return (
    <>
      {marquee.length > 0 && (
        <section className="mb-8">
          <div className={`grid ${marqueeGridCols(marquee.length)} gap-3`}>
            {marquee.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openAt(i)}
                className={`${marqueeAspect(marquee.length)} bg-[color:var(--ivory-deep,#f4f1ea)] rounded-[10px] overflow-hidden hover:opacity-90 transition-opacity`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.blob_url}
                  alt={p.original_filename ?? `Photo ${p.id}`}
                  className="w-full h-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {supporting.length > 0 && (
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {supporting.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openAt(marquee.length + i)}
                className="aspect-square bg-[color:var(--ivory-deep,#f4f1ea)] rounded-[10px] overflow-hidden hover:opacity-90 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.blob_url}
                  alt={p.original_filename ?? `Photo ${p.id}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />
    </>
  );
}
