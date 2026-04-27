"use client";
import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { EventPhoto } from "@/lib/event-photos/types";
import { PhotoCard } from "./PhotoCard";
import { PhotoLightbox } from "./PhotoLightbox";
import { BulkActionsBar } from "./BulkActionsBar";

export function PhotoGrid({
  photos,
  eventId,
}: {
  photos: EventPhoto[];
  eventId: number;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lastClickedId = useRef<number | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const orderedIds = useMemo(() => photos.map((p) => p.id), [photos]);

  const toggleSelect = (id: number, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClickedId.current != null && lastClickedId.current !== id) {
        const a = orderedIds.indexOf(lastClickedId.current);
        const b = orderedIds.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [start, end] = a < b ? [a, b] : [b, a];
          const adding = !prev.has(id);
          for (let i = start; i <= end; i++) {
            const pid = orderedIds[i];
            if (adding) next.add(pid);
            else next.delete(pid);
          }
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      lastClickedId.current = id;
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(orderedIds));
  const clearSelection = () => setSelectedIds(new Set());

  const handleMutated = () => {
    startTransition(() => router.refresh());
  };

  if (photos.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-sm text-[color:var(--muted)]">
        No photos in this view.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3 text-xs">
        <button
          type="button"
          onClick={selectedIds.size === photos.length ? clearSelection : selectAll}
          className="text-navy hover:underline font-semibold"
        >
          {selectedIds.size === photos.length ? "Deselect all" : `Select all (${photos.length})`}
        </button>
        {selectedIds.size > 0 && (
          <span className="text-[color:var(--muted)]">
            Tip: Shift-click to select a range.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((p, i) => (
          <PhotoCard
            key={p.id}
            photo={p}
            selected={selectedIds.has(p.id)}
            onToggleSelect={toggleSelect}
            onOpen={() => setLightboxIndex(i)}
          />
        ))}
      </div>

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        eventId={eventId}
        onClearSelection={clearSelection}
        onMutated={handleMutated}
      />

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />
    </>
  );
}
