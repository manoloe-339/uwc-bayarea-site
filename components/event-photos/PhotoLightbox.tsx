"use client";
import { useEffect, useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EventPhoto } from "@/lib/event-photos/types";

function toDateInputValue(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const photo = index != null ? photos[index] : null;

  const [takenInput, setTakenInput] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savingErr, setSavingErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the input when the active photo changes.
  useEffect(() => {
    setTakenInput(toDateInputValue(photo?.taken_at ?? null));
    setSavedAt(null);
    setSavingErr(null);
  }, [photo?.id, photo?.taken_at]);

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
      // Don't hijack arrows while user is typing into the date field.
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "INPUT") return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, next, prev, onClose]);

  const saveTakenAt = useCallback(
    async (value: string) => {
      if (!photo) return;
      const current = toDateInputValue(photo.taken_at ?? null);
      if (value === current) return; // no change
      setSaving(true);
      setSavingErr(null);
      try {
        const res = await fetch("/api/admin/event-photos/set-taken-at", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoId: photo.id,
            takenAt: value || null,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setSavedAt(Date.now());
        startTransition(() => router.refresh());
      } catch (err) {
        setSavingErr(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [photo, router]
  );

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
        className="max-w-[95vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.blob_url}
          alt={photo.original_filename ?? `Photo ${photo.id}`}
          className="max-w-full max-h-[78vh] object-contain"
        />
        <div className="text-white/70 text-xs mt-3 text-center">
          {(index ?? 0) + 1} / {photos.length}
          {photo.original_filename ? ` · ${photo.original_filename}` : ""}
          {photo.width && photo.height ? ` · ${photo.width}×${photo.height}` : ""}
        </div>

        {/* Capture date editor */}
        <div className="mt-3 flex items-center gap-2 flex-wrap justify-center bg-white/5 border border-white/15 rounded-full px-3 py-1.5">
          <label
            htmlFor="lightbox-taken-at"
            className="text-[10px] tracking-[.18em] uppercase font-bold text-white/70"
          >
            Capture date
          </label>
          <input
            id="lightbox-taken-at"
            type="date"
            value={takenInput}
            onChange={(e) => setTakenInput(e.target.value)}
            onBlur={(e) => void saveTakenAt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveTakenAt(takenInput);
              }
            }}
            className="bg-transparent text-white text-xs border border-white/20 rounded px-2 py-1 [color-scheme:dark]"
            min="1990-01-01"
            max={new Date().toISOString().slice(0, 10)}
          />
          {takenInput && (
            <button
              type="button"
              className="text-white/60 hover:text-white text-[10px] uppercase tracking-[.18em] font-semibold"
              onClick={() => {
                setTakenInput("");
                void saveTakenAt("");
              }}
            >
              Clear
            </button>
          )}
          <span
            className={`text-[10px] uppercase tracking-[.18em] font-bold ${
              savingErr
                ? "text-rose-300"
                : saving
                ? "text-white/60"
                : savedAt
                ? "text-emerald-300"
                : "text-white/30"
            }`}
            aria-live="polite"
          >
            {savingErr
              ? `Error: ${savingErr}`
              : saving
              ? "Saving…"
              : savedAt
              ? "Saved"
              : photo.taken_at
              ? "Set"
              : "Not set"}
          </span>
        </div>
      </div>
    </div>
  );
}
