"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MatchReviewModal } from "./MatchReviewModal";

type Props = {
  attendeeId: number;
  initialNotes: string | null;
  initialStarred: boolean;
  initialFollowup: boolean;
  alumniId: number | null;
  stripeName: string | null;
  stripeEmail: string | null;
  matchReason: string | null;
};

export function AttendeeRowActions({
  attendeeId,
  initialNotes,
  initialStarred,
  initialFollowup,
  alumniId,
  stripeName,
  stripeEmail,
  matchReason,
}: Props) {
  const [matchOpen, setMatchOpen] = useState(false);
  const [starred, setStarred] = useState(initialStarred);
  const [followup, setFollowup] = useState(initialFollowup);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const patch = async (body: Record<string, unknown>) => {
    await fetch(`/api/ticket-events/attendees/${attendeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    startTransition(() => router.refresh());
  };

  const toggleStar = async () => {
    const next = !starred;
    setStarred(next);
    await patch({ is_starred: next });
  };
  const toggleFollowup = async () => {
    const next = !followup;
    setFollowup(next);
    await patch({ needs_followup: next });
  };
  const saveNotes = async () => {
    await patch({ notes: notes.trim() || null });
    setEditingNotes(false);
  };
  const removeFromEvent = async () => {
    if (!confirm("Remove this person from the event? (Soft delete — won't reappear on next sync.)")) return;
    await patch({ delete: true });
    setMenuOpen(false);
  };

  return (
    <div className="flex items-start gap-1 shrink-0">
      <button
        type="button"
        onClick={toggleStar}
        aria-label={starred ? "Remove star" : "Star attendee"}
        title={starred ? "Remove star" : "Star attendee"}
        className={`p-1.5 rounded hover:bg-ivory-2 ${starred ? "text-amber-500" : "text-[color:var(--muted)]"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
      <button
        type="button"
        onClick={toggleFollowup}
        aria-label={followup ? "Clear follow-up flag" : "Flag for follow-up"}
        title={followup ? "Clear follow-up flag" : "Flag for follow-up"}
        className={`p-1.5 rounded hover:bg-ivory-2 ${followup ? "text-orange-600" : "text-[color:var(--muted)]"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={followup ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </button>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More actions"
          className="p-1.5 rounded hover:bg-ivory-2 text-[color:var(--muted)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="19" cy="12" r="1.75" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[color:var(--rule)] rounded-[8px] shadow-lg py-1 text-sm z-10">
            <button
              type="button"
              onClick={() => {
                setEditingNotes(true);
                setMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-ivory-2"
            >
              {notes ? "Edit notes" : "Add notes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMatchOpen(true);
                setMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-ivory-2"
            >
              {alumniId ? "Change match" : "Pick match"}
            </button>
            <button
              type="button"
              onClick={removeFromEvent}
              className="block w-full text-left px-3 py-2 hover:bg-ivory-2 text-red-700"
            >
              Remove from event
            </button>
          </div>
        )}
      </div>

      {matchOpen && (
        <MatchReviewModal
          attendeeId={attendeeId}
          currentAlumniId={alumniId}
          stripeName={stripeName}
          stripeEmail={stripeEmail}
          matchReason={matchReason}
          onClose={() => setMatchOpen(false)}
        />
      )}

      {editingNotes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white rounded-[12px] shadow-xl p-5 w-[90vw] max-w-[440px]">
            <h3 className="font-sans font-bold text-navy text-base mb-2">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
              rows={5}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
              placeholder="e.g. Sister of Alex Doe, bringing husband as plus-one"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNotes(initialNotes ?? "");
                  setEditingNotes(false);
                }}
                className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNotes}
                className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
