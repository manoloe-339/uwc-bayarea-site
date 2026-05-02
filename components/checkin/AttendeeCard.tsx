"use client";

import { useState } from "react";
import { getSchoolVisual } from "@/lib/uwc-school-visuals";

type Hit = {
  id: number;
  attendee_type: "paid" | "comp" | "walk-in";
  amount_paid: string;
  checked_in: boolean;
  checked_in_at: string | null;
  refund_status: string | null;
  display_first: string | null;
  display_last: string | null;
  display_email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  origin: string | null;
  photo_url: string | null;
  alumni_id: number | null;
  paid_at: string | null;
  tag_line_3?: string | null;
  tag_line_4?: string | null;
};

type Props = {
  hit: Hit;
  onCheckIn: () => Promise<void>;
  onUndo: () => Promise<void>;
  onCancel: () => void;
};

export function AttendeeCard({ hit, onCheckIn, onUndo, onCancel }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const name = [hit.display_first, hit.display_last].filter(Boolean).join(" ") || "Unknown";
  const initial = (hit.display_first?.[0] ?? hit.display_last?.[0] ?? "?").toUpperCase();
  const visual = getSchoolVisual(hit.uwc_college);
  const refunded = hit.refund_status === "refunded";
  const alreadyIn = hit.checked_in;

  const fmtPaidDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : null;

  const click = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onCheckIn();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[520px] mx-auto px-4 py-5">
      <button
        type="button"
        onClick={onCancel}
        className="text-sm text-[color:var(--muted)] hover:text-navy mb-4"
      >
        ← Back
      </button>

      <div className="bg-white border border-[color:var(--rule)] rounded-[16px] overflow-hidden shadow-sm">
        <div className="flex flex-col items-center p-6 pb-4">
          {hit.photo_url ? (
            <img
              src={hit.photo_url}
              alt=""
              className="w-[200px] h-[200px] rounded-full object-cover bg-ivory-2 border-2 border-[color:var(--rule)]"
            />
          ) : (
            <div
              className={`w-[200px] h-[200px] rounded-full flex items-center justify-center text-white font-sans font-bold text-6xl bg-gradient-to-br ${visual.gradient}`}
            >
              {initial}
            </div>
          )}
          <h1 className="mt-5 font-sans text-3xl font-bold text-[color:var(--navy-ink)] text-center uppercase tracking-wide">
            {name}
          </h1>
        </div>

        {hit.uwc_college && (
          <div
            className={`mx-5 mb-4 rounded-[12px] p-4 text-white bg-gradient-to-br ${visual.gradient}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{visual.icon}</span>
              {visual.flag && <span className="text-2xl">{visual.flag}</span>}
              <div>
                <div className="font-sans font-bold uppercase tracking-wide">
                  {hit.uwc_college}
                </div>
                {hit.grad_year && (
                  <div className="text-sm opacity-90">Class of {hit.grad_year}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {(hit.tag_line_3 || hit.tag_line_4) && (
          <div className="mx-5 mb-4 text-center">
            {hit.tag_line_3 && (
              <div className="font-sans italic text-base text-[color:var(--navy)] font-semibold">
                {hit.tag_line_3}
              </div>
            )}
            {hit.tag_line_4 && (
              <div className="font-sans italic text-sm text-[color:var(--muted)] mt-0.5">
                {hit.tag_line_4}
              </div>
            )}
          </div>
        )}

        <div className="px-5 pb-5 text-sm space-y-1.5 text-[color:var(--navy-ink)]">
          {hit.origin && (
            <div>
              🌍 <span className="text-[color:var(--muted)]">From:</span>{" "}
              <strong>{hit.origin}</strong>
            </div>
          )}
          {hit.attendee_type === "paid" ? (
            <div>
              🎟️ Paid ${Number(hit.amount_paid || 0).toFixed(2)}
              {fmtPaidDate(hit.paid_at) ? ` on ${fmtPaidDate(hit.paid_at)}` : ""}
            </div>
          ) : hit.attendee_type === "comp" ? (
            <div>🎟️ Special guest (comp)</div>
          ) : (
            <div>🎟️ Walk-in</div>
          )}
          {hit.display_email && (
            <div className="text-xs text-[color:var(--muted)] break-all">
              {hit.display_email}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          {refunded ? (
            <div className="bg-red-50 border border-red-200 rounded-[10px] p-4 text-sm">
              <div className="font-semibold text-red-800 mb-1">⚠️ Ticket refunded</div>
              <div className="text-red-800/80">
                This ticket was refunded and can&rsquo;t be checked in.
              </div>
            </div>
          ) : alreadyIn ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-[10px] p-4 text-sm mb-3">
                <div className="font-semibold text-green-800">✅ Already checked in</div>
                {hit.checked_in_at && (
                  <div className="text-green-800/80 mt-0.5">
                    at{" "}
                    {new Date(hit.checked_in_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onUndo}
                className="w-full border border-red-700 text-red-700 hover:bg-red-50 px-5 py-3 rounded-[12px] text-base font-semibold"
              >
                Undo check-in
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={click}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-5 py-4 rounded-[12px] text-lg font-sans font-bold disabled:opacity-60"
            >
              {submitting ? "Checking in…" : "✓ Check in"}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-5 w-full text-center text-sm text-[color:var(--muted)] hover:text-navy"
      >
        Cancel — back to search
      </button>
    </div>
  );
}
