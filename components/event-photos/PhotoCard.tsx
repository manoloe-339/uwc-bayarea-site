"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalStatus, DisplayRole, EventPhoto } from "@/lib/event-photos/types";

const statusBadge: Record<EventPhoto["approval_status"], { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "bg-emerald-600 text-white border-emerald-700" },
  pending: { label: "Pending", cls: "bg-amber-500 text-white border-amber-600" },
  rejected: { label: "Rejected", cls: "bg-rose-600 text-white border-rose-700" },
};

type CardPhoto = EventPhoto & {
  is_duplicate?: boolean;
  primary_status?: ApprovalStatus | null;
};

export function PhotoCard({
  photo,
  selected,
  onToggleSelect,
  onOpen,
}: {
  photo: CardPhoto;
  selected: boolean;
  onToggleSelect: (id: number, shiftKey: boolean) => void;
  onOpen: (id: number) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimisticRole, setOptimisticRole] = useState<DisplayRole | null | undefined>(undefined);
  const [optimisticStatus, setOptimisticStatus] = useState<ApprovalStatus | undefined>(undefined);
  const [pending, setPending] = useState(false);

  const effectiveRole = optimisticRole !== undefined ? optimisticRole : photo.display_role;
  const effectiveStatus = optimisticStatus ?? photo.approval_status;
  const isStarred = effectiveRole === "marquee";
  const badge = statusBadge[effectiveStatus];
  const isDup = photo.is_duplicate === true;

  const onStarClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pending) return;
    // Optimistic update — flip immediately, the server confirms.
    const willBeMarquee = !isStarred;
    setOptimisticRole(willBeMarquee ? "marquee" : null);
    if (willBeMarquee && effectiveStatus === "pending") {
      setOptimisticStatus("approved");
    }
    setPending(true);
    try {
      const res = await fetch("/api/admin/event-photos/star-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch {
      // Roll back optimistic update on error
      setOptimisticRole(undefined);
      setOptimisticStatus(undefined);
    } finally {
      setPending(false);
    }
  };

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
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
        <div
          className={`text-[11px] tracking-[.1em] uppercase font-bold px-2 py-0.5 rounded border shadow-sm ${badge.cls}`}
        >
          {badge.label}
        </div>
        {isDup && (
          <div className="text-[10px] tracking-[.1em] uppercase font-bold px-2 py-0.5 rounded border border-slate-400 bg-slate-700 text-white shadow-sm">
            Duplicate
          </div>
        )}
      </div>

      {/* Star (marquee toggle) — bottom-right corner */}
      <button
        type="button"
        onClick={onStarClick}
        disabled={pending}
        title={isStarred ? "Remove from marquee" : "Approve & add to marquee"}
        aria-label={isStarred ? "Remove from marquee" : "Approve and add to marquee"}
        aria-pressed={isStarred}
        className={`absolute bottom-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm border ${
          isStarred
            ? "bg-amber-400 border-amber-500 text-white hover:bg-amber-500"
            : "bg-white/90 border-[color:var(--rule)] text-[color:var(--muted)] hover:text-amber-500 hover:bg-white"
        } ${pending ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
      >
        <StarIcon filled={isStarred} />
      </button>

      {isDup && photo.primary_status && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] tracking-[.08em] uppercase font-semibold px-2 py-1">
          Primary: {photo.primary_status}
        </div>
      )}
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
