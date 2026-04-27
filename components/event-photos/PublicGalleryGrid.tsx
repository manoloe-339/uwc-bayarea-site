"use client";
import { useState } from "react";
import Image from "next/image";
import type { EventPhoto } from "@/lib/event-photos/types";
import { PhotoLightbox } from "./PhotoLightbox";

export function PublicGalleryGrid({ photos }: { photos: EventPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const marquee = photos.filter((p) => p.display_role === "marquee");
  const supporting = photos.filter((p) => p.display_role !== "marquee");

  const openAt = (i: number) => setLightboxIndex(i);

  return (
    <>
      {marquee.length > 0 && (
        <section className="mb-10">
          <MarqueeLayout marquee={marquee} onOpen={openAt} />
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

function MarqueePhoto({
  photo,
  onClick,
  className,
  sizes,
  priority,
}: {
  photo: EventPhoto;
  onClick: () => void;
  className: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative bg-[color:var(--ivory-deep,#f4f1ea)] rounded-[10px] overflow-hidden hover:opacity-90 transition-opacity ${className}`}
    >
      <Image
        src={photo.blob_url}
        alt={photo.original_filename ?? `Photo ${photo.id}`}
        fill
        sizes={sizes}
        className="object-cover"
        priority={priority}
      />
    </button>
  );
}

function MarqueeLayout({
  marquee,
  onOpen,
}: {
  marquee: EventPhoto[];
  onOpen: (i: number) => void;
}) {
  // 1 photo: full-width 16:9 hero.
  if (marquee.length === 1) {
    return (
      <MarqueePhoto
        photo={marquee[0]}
        onClick={() => onOpen(0)}
        className="aspect-[16/9] w-full"
        sizes="(max-width: 1100px) 100vw, 1100px"
        priority
      />
    );
  }

  // 2 photos: side-by-side at 4:3 each.
  if (marquee.length === 2) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {marquee.map((p, i) => (
          <MarqueePhoto
            key={p.id}
            photo={p}
            onClick={() => onOpen(i)}
            className="aspect-[4/3]"
            sizes="(max-width: 640px) 100vw, 50vw"
            priority={i === 0}
          />
        ))}
      </div>
    );
  }

  // 3+ photos: magazine layout — hero spans 2/3 width and full height,
  // next 2 stack to the right. Any 4th+ photos wrap in a 3-up row below.
  const [hero, second, third, ...rest] = marquee;
  return (
    <>
      {/* Mobile: stack all three at 16:9. Desktop: magazine grid (3:2 container). */}
      <div className="grid grid-cols-1 sm:grid-cols-3 sm:grid-rows-2 gap-3 sm:aspect-[3/2]">
        <MarqueePhoto
          photo={hero}
          onClick={() => onOpen(0)}
          className="aspect-[16/9] sm:aspect-auto sm:col-span-2 sm:row-span-2"
          sizes="(max-width: 640px) 100vw, 66vw"
          priority
        />
        <MarqueePhoto
          photo={second}
          onClick={() => onOpen(1)}
          className="aspect-[16/9] sm:aspect-auto"
          sizes="(max-width: 640px) 100vw, 33vw"
        />
        <MarqueePhoto
          photo={third}
          onClick={() => onOpen(2)}
          className="aspect-[16/9] sm:aspect-auto"
          sizes="(max-width: 640px) 100vw, 33vw"
        />
      </div>
      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          {rest.map((p, i) => (
            <MarqueePhoto
              key={p.id}
              photo={p}
              onClick={() => onOpen(3 + i)}
              className="aspect-[4/3]"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
          ))}
        </div>
      )}
    </>
  );
}
