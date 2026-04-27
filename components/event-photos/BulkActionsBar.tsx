"use client";
import { useState } from "react";

export function BulkActionsBar({
  selectedIds,
  eventId,
  onClearSelection,
  onMutated,
}: {
  selectedIds: number[];
  eventId: number;
  onClearSelection: () => void;
  onMutated: () => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | "delete" | "zip" | null>(null);

  if (selectedIds.length === 0) return null;

  const post = async (path: string) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: selectedIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Error: ${err.error ?? res.statusText}`);
      return false;
    }
    return true;
  };

  const handleApprove = async () => {
    setBusy("approve");
    if (await post("/api/admin/event-photos/approve")) {
      onClearSelection();
      onMutated();
    }
    setBusy(null);
  };

  const handleReject = async () => {
    setBusy("reject");
    if (await post("/api/admin/event-photos/reject")) {
      onClearSelection();
      onMutated();
    }
    setBusy(null);
  };

  const handleDelete = async () => {
    const n = selectedIds.length;
    if (
      !confirm(
        `Permanently delete ${n} photo${n === 1 ? "" : "s"}?\n\n` +
          `This removes ${n === 1 ? "it" : "them"} from the database AND from blob storage. This cannot be undone.`
      )
    )
      return;
    setBusy("delete");
    if (await post("/api/admin/event-photos/delete")) {
      onClearSelection();
      onMutated();
    }
    setBusy(null);
  };

  const handleZip = () => {
    setBusy("zip");
    const url = `/api/admin/event-photos/download-zip?eventId=${eventId}&ids=${selectedIds.join(",")}`;
    window.location.href = url;
    setTimeout(() => setBusy(null), 800);
  };

  return (
    <div className="sticky bottom-3 z-20 mb-3">
      <div className="bg-navy text-white rounded-[10px] shadow-lg px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">
          {selectedIds.length} selected
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy !== null}
            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded disabled:opacity-50"
          >
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={busy !== null}
            className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded disabled:opacity-50"
          >
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            onClick={handleZip}
            disabled={busy !== null}
            className="text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded disabled:opacity-50"
          >
            {busy === "zip" ? "Preparing…" : "Download ZIP"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy !== null}
            className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded disabled:opacity-50"
          >
            {busy === "delete" ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={busy !== null}
            className="text-xs text-white/70 hover:text-white underline px-2"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
