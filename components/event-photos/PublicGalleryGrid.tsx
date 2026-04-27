"use client";
import { useState } from "react";
import Image from "next/image";
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
                className={`relative ${marqueeAspect(marquee.length)} bg-[color:var(--ivory-deep,#f4f1ea)] rounded-[10px] overflow-hidden hover:opacity-90 transition-opacity`}
              >
                <Image
                  src={p.blob_url}
                  alt={p.original_filename ?? `Photo ${p.id}`}
                  fill
                  sizes={marquee.length === 1 ? "(max-width: 1100px) 100vw, 1100px" : marquee.length === 2 ? "(max-width: 640px) 100vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"}
                  className="object-cover"
                  priority={i === 0}
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
                className="relative aspect-square bg-[color:var(--ivory-deep,#f4f1ea)] rounded-[10px] overflow-hidden hover:opacity-90 transition-opacity"
              >
                <Image
                  src={p.blob_url}
                  alt={p.original_filename ?? `Photo ${p.id}`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  className="object-cover"
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
