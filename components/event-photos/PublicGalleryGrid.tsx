"use client";
import { useState } from "react";
import type { EventPhoto } from "@/lib/event-photos/types";
import { PhotoLightbox } from "./PhotoLightbox";

export function PublicGalleryGrid({ photos }: { photos: EventPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setLightboxIndex(i)}
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

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />
    </>
  );
}
