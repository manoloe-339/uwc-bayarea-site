"use client";
import { useEffect, useCallback } from "react";
import type { EventPhoto } from "@/lib/event-photos/types";

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onChangeIndex,
}: {
  photos: EventPhoto[];
  index: number | null;
  onClose: () => void;
  onChangeIndex: (i: number) => void;
}) {
  const photo = index != null ? photos[index] : null;

  const next = useCallback(() => {
    if (index == null || photos.length === 0) return;
    onChangeIndex((index + 1) % photos.length);
  }, [index, photos.length, onChangeIndex]);

  const prev = useCallback(() => {
    if (index == null || photos.length === 0) return;
    onChangeIndex((index - 1 + photos.length) % photos.length);
  }, [index, photos.length, onChangeIndex]);

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, next, prev, onClose]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 right-4 text-white text-2xl px-3 py-1 rounded hover:bg-white/10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        ×
      </button>
      <button
        type="button"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl px-3 py-2 rounded hover:bg-white/10"
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
        aria-label="Previous"
      >
        ‹
      </button>
      <button
        type="button"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl px-3 py-2 rounded hover:bg-white/10"
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
        aria-label="Next"
      >
        ›
      </button>
      <div
        className="max-w-[95vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.blob_url}
          alt={photo.original_filename ?? `Photo ${photo.id}`}
          className="max-w-full max-h-[90vh] object-contain"
        />
        <div className="text-white/70 text-xs mt-2 text-center">
          {(index ?? 0) + 1} / {photos.length}
          {photo.original_filename ? ` · ${photo.original_filename}` : ""}
          {photo.width && photo.height ? ` · ${photo.width}×${photo.height}` : ""}
        </div>
      </div>
    </div>
  );
}
