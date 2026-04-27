"use client";
import Image from "next/image";
import type { EventPhoto } from "@/lib/event-photos/types";

const statusBadge: Record<EventPhoto["approval_status"], { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "bg-emerald-600 text-white border-emerald-700" },
  pending: { label: "Pending", cls: "bg-amber-500 text-white border-amber-600" },
  rejected: { label: "Rejected", cls: "bg-rose-600 text-white border-rose-700" },
};

export function PhotoCard({
  photo,
  selected,
  onToggleSelect,
  onOpen,
}: {
  photo: EventPhoto;
  selected: boolean;
  onToggleSelect: (id: number, shiftKey: boolean) => void;
  onOpen: (id: number) => void;
}) {
  const badge = statusBadge[photo.approval_status];
  return (
    <div
      className={`group relative bg-white border rounded-[10px] overflow-hidden ${
        selected ? "border-navy ring-2 ring-navy/30" : "border-[color:var(--rule)]"
      }`}
    >
      <div className="absolute top-2 left-2 z-10">
        <label
          className="flex items-center justify-center w-6 h-6 bg-white/90 backdrop-blur rounded border border-[color:var(--rule)] cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelect(photo.id, (e.nativeEvent as MouseEvent).shiftKey ?? false)}
            className="accent-navy"
          />
        </label>
      </div>
      <div
        className={`absolute top-2 right-2 z-10 text-[11px] tracking-[.1em] uppercase font-bold px-2 py-0.5 rounded border shadow-sm ${badge.cls}`}
      >
        {badge.label}
      </div>
      <button
        type="button"
        onClick={() => onOpen(photo.id)}
        className="block relative w-full aspect-square bg-[color:var(--ivory-deep,#f4f1ea)]"
      >
        <Image
          src={photo.blob_url}
          alt={photo.original_filename ?? `Photo ${photo.id}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          className="object-cover"
        />
      </button>
    </div>
  );
}
