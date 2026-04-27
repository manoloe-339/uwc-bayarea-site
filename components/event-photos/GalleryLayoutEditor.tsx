"use client";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { EventPhoto, DisplayRole } from "@/lib/event-photos/types";

type RoleColumn = "marquee" | "supporting";

function partition(photos: EventPhoto[]): { marquee: EventPhoto[]; supporting: EventPhoto[] } {
  const marquee = photos
    .filter((p) => p.display_role === "marquee")
    .sort((a, b) => (a.display_order ?? 1e9) - (b.display_order ?? 1e9));
  const supporting = photos
    .filter((p) => p.display_role !== "marquee")
    .sort((a, b) => {
      const ao = a.display_order ?? 1e9;
      const bo = b.display_order ?? 1e9;
      if (ao !== bo) return ao - bo;
      return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
    });
  return { marquee, supporting };
}

export function GalleryLayoutEditor({
  photos,
  eventId,
}: {
  photos: EventPhoto[];
  eventId: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<number | null>(null);

  const { marquee, supporting } = useMemo(() => partition(photos), [photos]);

  const refresh = () => startTransition(() => router.refresh());

  const post = async (path: string, payload: unknown) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Error: ${err.error ?? res.statusText}`);
      return false;
    }
    return true;
  };

  const togglePromote = async (photo: EventPhoto) => {
    setBusy(photo.id);
    const goingToMarquee = photo.display_role !== "marquee";
    const targetRole: DisplayRole = goingToMarquee ? "marquee" : "supporting";
    const targetList = goingToMarquee ? marquee : supporting;
    const newOrder = targetList.length;
    const ok = await post("/api/admin/event-photos/set-layout", {
      photoId: photo.id,
      displayRole: targetRole,
      displayOrder: newOrder,
    });
    setBusy(null);
    if (ok) refresh();
  };

  const move = async (column: RoleColumn, fromIdx: number, direction: -1 | 1) => {
    const list = column === "marquee" ? marquee : supporting;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const next = [...list];
    const [picked] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, picked);
    setBusy(list[fromIdx].id);
    const role: DisplayRole = column === "marquee" ? "marquee" : "supporting";
    const ok = await post("/api/admin/event-photos/reorder", {
      eventId,
      role,
      photoIds: next.map((p) => p.id),
    });
    setBusy(null);
    if (ok) refresh();
  };

  if (photos.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-sm text-[color:var(--muted)]">
        Approve photos first, then come here to lay out the gallery.
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Column
        title="Marquee"
        hint="Hero photos at the top of the public gallery. Tip: 1–3 work best."
        photos={marquee}
        column="marquee"
        busy={busy}
        onTogglePromote={togglePromote}
        onMove={move}
        emptyText="No marquee photos yet. Click ★ on a supporting photo to feature it."
      />
      <Column
        title="Supporting"
        hint="Everything else. Shown in a grid below the marquee."
        photos={supporting}
        column="supporting"
        busy={busy}
        onTogglePromote={togglePromote}
        onMove={move}
        emptyText="No supporting photos."
      />
    </div>
  );
}

function Column({
  title,
  hint,
  photos,
  column,
  busy,
  onTogglePromote,
  onMove,
  emptyText,
}: {
  title: string;
  hint: string;
  photos: EventPhoto[];
  column: RoleColumn;
  busy: number | null;
  onTogglePromote: (p: EventPhoto) => void;
  onMove: (column: RoleColumn, fromIdx: number, direction: -1 | 1) => void;
  emptyText: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-sans text-lg font-bold text-[color:var(--navy-ink)]">
          {title}
          <span className="ml-2 text-sm font-normal text-[color:var(--muted)]">
            {photos.length}
          </span>
        </h3>
      </div>
      <p className="text-xs text-[color:var(--muted)] mb-3">{hint}</p>
      {photos.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-6 text-center text-xs text-[color:var(--muted)]">
          {emptyText}
        </div>
      ) : (
        <ul className="space-y-2">
          {photos.map((p, i) => (
            <li
              key={p.id}
              className="bg-white border border-[color:var(--rule)] rounded-[10px] p-2 flex items-center gap-3"
            >
              <span className="text-xs text-[color:var(--muted)] tabular-nums w-6 text-right">
                {i + 1}
              </span>
              <div className="relative w-16 h-16 rounded overflow-hidden bg-[color:var(--ivory-deep,#f4f1ea)] shrink-0">
                <Image
                  src={p.blob_url}
                  alt={p.original_filename ?? `Photo ${p.id}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-xs text-[color:var(--muted)] truncate">
                {p.original_filename ?? `Photo ${p.id}`}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy === p.id || i === 0}
                  onClick={() => onMove(column, i, -1)}
                  title="Move up"
                  className="w-7 h-7 flex items-center justify-center border border-[color:var(--rule)] rounded text-sm hover:bg-ivory disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy === p.id || i === photos.length - 1}
                  onClick={() => onMove(column, i, 1)}
                  title="Move down"
                  className="w-7 h-7 flex items-center justify-center border border-[color:var(--rule)] rounded text-sm hover:bg-ivory disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => onTogglePromote(p)}
                  title={column === "marquee" ? "Demote to supporting" : "Promote to marquee"}
                  className={`w-7 h-7 flex items-center justify-center border rounded text-sm disabled:opacity-30 ${
                    column === "marquee"
                      ? "border-amber-500 text-amber-700 hover:bg-amber-50"
                      : "border-navy text-navy hover:bg-navy hover:text-white"
                  }`}
                >
                  {column === "marquee" ? "★" : "☆"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
