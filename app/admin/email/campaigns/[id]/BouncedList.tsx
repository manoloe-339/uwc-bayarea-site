"use client";

/**
 * Dedicated "Bounced (N)" panel at the top of the campaign detail
 * page. Each row has a one-click "Mark email as invalid" that flips
 * the alumni.email_invalid flag — every future campaign's recipient
 * filter already excludes those, so bad addresses stop wasting quota
 * on subsequent sends.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markEmailInvalidAction } from "../actions";
import { fmtDateTimeShort } from "@/lib/admin-time";

export type BouncedRow = {
  alumniId: number | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  bouncedAt: string | null;
};

export default function BouncedList({
  campaignId,
  rows,
}: {
  campaignId: string;
  rows: BouncedRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(new Set());

  function markInvalid(alumniId: number) {
    startTransition(async () => {
      await markEmailInvalidAction(alumniId, true, campaignId);
      setFlaggedIds((prev) => new Set(prev).add(alumniId));
      router.refresh();
    });
  }

  return (
    <section className="bg-white border-l-4 border-orange-500 border-t border-r border-b border-[color:var(--rule)] rounded-[10px] overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-[color:var(--rule)]">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-orange-700">
          Bounced ({rows.length})
        </h2>
        <p className="text-xs text-[color:var(--muted)] mt-1">
          These addresses rejected the message. Mark them invalid so future
          campaigns skip them.
        </p>
      </div>
      <ul className="divide-y divide-[color:var(--rule)]">
        {rows.map((r) => {
          const name = [r.firstName, r.lastName].filter(Boolean).join(" ") || "—";
          const alreadyFlagged = r.alumniId != null && flaggedIds.has(r.alumniId);
          return (
            <li
              key={`${r.alumniId ?? "?"}-${r.email}`}
              className="px-5 py-3 flex items-center gap-4 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-navy truncate">
                  {r.alumniId != null ? (
                    <Link
                      href={`/admin/alumni/${r.alumniId}`}
                      className="hover:underline"
                    >
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </div>
                <div className="text-[color:var(--muted)] truncate">{r.email}</div>
              </div>
              <div className="text-xs text-[color:var(--muted)] whitespace-nowrap">
                {r.bouncedAt ? fmtDateTimeShort(r.bouncedAt) : ""}
              </div>
              {r.alumniId != null ? (
                alreadyFlagged ? (
                  <span className="text-xs text-green-700 font-semibold whitespace-nowrap">
                    ✓ Marked invalid
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => markInvalid(r.alumniId!)}
                    className="text-xs font-semibold text-white bg-orange-600 px-3 py-1.5 rounded hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    Mark invalid
                  </button>
                )
              ) : (
                <span className="text-xs text-[color:var(--muted)]">
                  Unlinked
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
