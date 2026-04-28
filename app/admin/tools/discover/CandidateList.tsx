"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CandidateCard from "./CandidateCard";

type Candidate = {
  id: number;
  linkedin_url: string;
  name_guess: string | null;
  title_snippet: string | null;
  body_snippet: string | null;
  source: string | null;
  search_query: string | null;
  status: "new" | "probable_match" | "possible_match" | "confirmed" | "invited_linkedin" | "already_connected" | "scraped" | "added" | "rejected";
  matched_alumni_id: number | null;
  scraped_data: unknown;
  discovered_at: string;
  triage_confidence: "high" | "medium" | "low" | null;
  triage_role: "alum" | "student" | "teacher" | "staff" | "unrelated" | null;
  triage_reasoning: string | null;
  run_id: number | null;
};

const SELECTABLE_STATUSES: Candidate["status"][] = [
  "new",
  "probable_match",
  "possible_match",
  "confirmed",
];

export default function CandidateList({
  rows,
  recentRunId,
  inviteTemplate,
}: {
  rows: Candidate[];
  recentRunId: number | null;
  inviteTemplate: string;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<"confirm" | "reject" | "invited_linkedin" | "already_connected" | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Selection only meaningful on tabs where bulk action makes sense.
  const selectionEnabled =
    rows.length > 0 && SELECTABLE_STATUSES.includes(rows[0].status);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(rows.map((r) => r.id)));
  const clear = () => setSelected(new Set());

  const bulkUpdate = async (
    status: "confirmed" | "rejected" | "invited_linkedin" | "already_connected"
  ) => {
    if (selected.size === 0) return;
    if (status === "rejected" && !confirm(`Reject ${selected.size} candidate${selected.size === 1 ? "" : "s"}?`)) {
      return;
    }
    const busyMap: Record<typeof status, NonNullable<typeof busy>> = {
      confirmed: "confirm",
      rejected: "reject",
      invited_linkedin: "invited_linkedin",
      already_connected: "already_connected",
    };
    setBusy(busyMap[status]);
    try {
      const res = await fetch("/api/admin/discovery/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Error: ${data.error ?? res.statusText}`);
        return;
      }
      clear();
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return null;

  // Split: candidates from the most recent run vs older. If we don't
  // know a recent run id (e.g., legacy rows with run_id=null only),
  // everything goes in "recent".
  const recent: Candidate[] = [];
  const older: Candidate[] = [];
  for (const r of rows) {
    if (recentRunId != null && r.run_id !== recentRunId) older.push(r);
    else recent.push(r);
  }

  // For non-selectable tabs, render plain list with collapse but no bulk bar.
  if (!selectionEnabled) {
    return (
      <>
        <ul className="space-y-3">
          {recent.map((c) => (
            <li key={c.id}>
              <CandidateCard candidate={c} inviteTemplate={inviteTemplate} />
            </li>
          ))}
        </ul>
        {older.length > 0 && (
          <details className="mt-6 group">
            <summary className="cursor-pointer text-sm font-semibold text-navy hover:underline list-none">
              <span className="group-open:hidden">▸ Show {older.length} from earlier runs</span>
              <span className="hidden group-open:inline">▾ Hide earlier runs</span>
            </summary>
            <ul className="space-y-3 mt-3">
              {older.map((c) => (
                <li key={c.id}>
                  <CandidateCard candidate={c} inviteTemplate={inviteTemplate} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </>
    );
  }

  const allSelected = selected.size === rows.length;

  return (
    <>
      <div className="flex items-center justify-between mb-3 text-xs">
        <button
          type="button"
          onClick={allSelected ? clear : selectAll}
          className="text-navy font-semibold hover:underline"
        >
          {allSelected ? "Deselect all" : `Select all (${rows.length})`}
        </button>
        <span className="text-[color:var(--muted)]">
          Tip: use the checkbox to select multiple, then confirm or reject in bulk.
        </span>
      </div>

      <ul className="space-y-3">
        {recent.map((c) => (
          <li key={c.id}>
            <CandidateCard
              candidate={c}
              selected={selected.has(c.id)}
              onToggleSelect={toggle}
              inviteTemplate={inviteTemplate}
            />
          </li>
        ))}
      </ul>

      {older.length > 0 && (
        <details className="mt-6 group">
          <summary className="cursor-pointer text-sm font-semibold text-navy hover:underline list-none">
            <span className="group-open:hidden">▸ Show {older.length} from earlier runs</span>
            <span className="hidden group-open:inline">▾ Hide earlier runs</span>
          </summary>
          <ul className="space-y-3 mt-3">
            {older.map((c) => (
              <li key={c.id}>
                <CandidateCard
                  candidate={c}
                  selected={selected.has(c.id)}
                  onToggleSelect={toggle}
                />
              </li>
            ))}
          </ul>
        </details>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-3 z-20 mt-4">
          <div className="bg-navy text-white rounded-[10px] shadow-lg px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">
              {selected.size} selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {rows[0].status !== "confirmed" && (
                <button
                  type="button"
                  onClick={() => bulkUpdate("confirmed")}
                  disabled={busy !== null}
                  className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded disabled:opacity-50"
                >
                  {busy === "confirm" ? "Confirming…" : "Confirm"}
                </button>
              )}
              {rows[0].status === "confirmed" && (
                <>
                  <button
                    type="button"
                    onClick={() => bulkUpdate("invited_linkedin")}
                    disabled={busy !== null}
                    className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded disabled:opacity-50"
                  >
                    {busy === "invited_linkedin" ? "Marking…" : "Mark invited"}
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkUpdate("already_connected")}
                    disabled={busy !== null}
                    className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded disabled:opacity-50"
                  >
                    {busy === "already_connected" ? "Marking…" : "Already connected"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => bulkUpdate("rejected")}
                disabled={busy !== null}
                className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded disabled:opacity-50"
              >
                {busy === "reject" ? "Rejecting…" : "Reject"}
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={busy !== null}
                className="text-xs text-white/70 hover:text-white underline px-2"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
