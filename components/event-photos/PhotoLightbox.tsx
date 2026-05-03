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

type AssignableEvent = { id: number; slug: string; name: string; date: string };

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onChangeIndex,
  assignableEvents,
  adminMode = false,
}: {
  photos: EventPhoto[];
  index: number | null;
  onClose: () => void;
  onChangeIndex: (i: number) => void;
  assignableEvents?: AssignableEvent[];
  /** When true, shows admin-only controls (capture date editor,
   * assign-to-event dropdown). Defaults to false so the public gallery
   * lightbox stays clean. */
  adminMode?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const photo = index != null ? photos[index] : null;

  const [takenInput, setTakenInput] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savingErr, setSavingErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Sort galleries newest-date-first for the dropdown.
  const sortedAssignable = (assignableEvents ?? [])
    .slice()
    .sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));

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

  const assignToEvent = useCallback(
    async (eventId: number) => {
      if (!photo) return;
      const target = sortedAssignable.find((e) => e.id === eventId);
      if (!target) return;
      if (
        !confirm(
          `Move this photo to "${target.name}" and set its capture date to ${toDateInputValue(target.date)}?`
        )
      ) {
        return;
      }
      setAssigning(true);
      setSavingErr(null);
      try {
        const res = await fetch("/api/admin/event-photos/assign-to-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId: photo.id, eventId }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        // Photo no longer belongs to this view — close the lightbox and
        // refresh the parent grid so the photo disappears from the list.
        onClose();
        startTransition(() => router.refresh());
      } catch (err) {
        setSavingErr(err instanceof Error ? err.message : "Assign failed");
      } finally {
        setAssigning(false);
      }
    },
    [photo, router, sortedAssignable, onClose]
  );

  if (!photo) return null;

  const statusText = savingErr
    ? `Error: ${savingErr}`
    : assigning
    ? "Assigning…"
    : saving
    ? "Saving…"
    : savedAt
    ? "Saved"
    : photo.taken_at
    ? "Set"
    : "Not set";

  const statusColor = savingErr
    ? "text-rose-300"
    : saving || assigning
    ? "text-white/60"
    : savedAt
    ? "text-emerald-300"
    : "text-white/40";

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Close button */}
      <button
        type="button"
        className="absolute top-3 right-3 z-20 text-white text-2xl w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      {/* Photo viewport — fills the space above the controls panel */}
      <div
        className="flex-1 min-h-0 relative flex items-center justify-center px-2 sm:px-12"
        onClick={onClose}
      >
        <button
          type="button"
          className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-10 text-white text-3xl w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center"
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
          className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-10 text-white text-3xl w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          aria-label="Next"
        >
          ›
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.blob_url}
          alt={photo.original_filename ?? `Photo ${photo.id}`}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Controls panel — pinned to viewport bottom, always visible */}
      <div
        className="shrink-0 bg-black/85 backdrop-blur border-t border-white/10 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-[900px] mx-auto px-4 py-3 space-y-2.5">
          {/* Meta line — counter always; filename + dimensions admin-only. */}
          <div className="text-[11px] text-white/65 text-center truncate">
            {(index ?? 0) + 1} / {photos.length}
            {adminMode && photo.original_filename ? ` · ${photo.original_filename}` : ""}
            {adminMode && photo.width && photo.height ? ` · ${photo.width}×${photo.height}` : ""}
          </div>

          {/* Capture date row — admin only */}
          {adminMode && (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <label
                htmlFor="lightbox-taken-at"
                className="text-[10px] tracking-[.18em] uppercase font-bold text-white/65 whitespace-nowrap"
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
                className="bg-white/5 text-white text-xs border border-white/20 rounded px-2 py-1 [color-scheme:dark]"
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
                className={`text-[10px] uppercase tracking-[.18em] font-bold ${statusColor}`}
                aria-live="polite"
              >
                {statusText}
              </span>
            </div>
          )}

          {/* Assign to existing gallery (archive admin only) */}
          {adminMode && sortedAssignable.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <label
                htmlFor="lightbox-assign-event"
                className="text-[10px] tracking-[.18em] uppercase font-bold text-white/65 whitespace-nowrap"
              >
                Assign to gallery
              </label>
              <select
                id="lightbox-assign-event"
                defaultValue=""
                disabled={assigning}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (Number.isFinite(id) && id > 0) void assignToEvent(id);
                  e.target.value = "";
                }}
                className="bg-white/5 text-white text-xs border border-white/20 rounded px-2 py-1 max-w-[260px]"
              >
                <option value="" className="bg-black">Pick an event…</option>
                {sortedAssignable.map((e) => (
                  <option key={e.id} value={e.id} className="bg-black">
                    {toDateInputValue(e.date)} · {e.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
