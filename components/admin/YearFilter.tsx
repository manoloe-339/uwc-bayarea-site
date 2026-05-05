"use client";

import { useMemo, useState } from "react";

type Mode = "any" | "exact" | "before" | "after" | "between";

function inferMode(from: number | undefined, to: number | undefined): Mode {
  if (from == null && to == null) return "any";
  if (from != null && to != null && from === to) return "exact";
  if (from != null && to != null) return "between";
  if (to != null) return "before";
  return "after";
}

export default function YearFilter({
  initialFrom,
  initialTo,
}: {
  initialFrom?: number;
  initialTo?: number;
}) {
  const initialMode = inferMode(initialFrom, initialTo);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [y1, setY1] = useState<string>(
    initialMode === "before"
      ? String((initialTo ?? 0) + 1)
      : initialMode === "after"
        ? String((initialFrom ?? 0) - 1)
        : String(initialFrom ?? initialTo ?? "")
  );
  const [y2, setY2] = useState<string>(initialMode === "between" ? String(initialTo ?? "") : "");

  const { yearFrom, yearTo } = useMemo(() => {
    const n1 = Number(y1);
    const n2 = Number(y2);
    const v1 = Number.isFinite(n1) && y1 ? n1 : null;
    const v2 = Number.isFinite(n2) && y2 ? n2 : null;
    if (mode === "exact" && v1 != null) return { yearFrom: v1, yearTo: v1 };
    if (mode === "before" && v1 != null) return { yearFrom: null, yearTo: v1 - 1 };
    if (mode === "after" && v1 != null) return { yearFrom: v1 + 1, yearTo: null };
    if (mode === "between" && v1 != null && v2 != null)
      return { yearFrom: Math.min(v1, v2), yearTo: Math.max(v1, v2) };
    return { yearFrom: null, yearTo: null };
  }, [mode, y1, y2]);

  return (
    <div className="block sm:col-span-2">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        📅 Graduation year
      </span>
      <div className="flex flex-wrap items-stretch gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className="border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white min-w-[140px]"
        >
          <option value="any">Any year</option>
          <option value="exact">In year</option>
          <option value="before">Before year</option>
          <option value="after">After year</option>
          <option value="between">Between</option>
        </select>

        {mode !== "any" && (
          <input
            type="number"
            value={y1}
            onChange={(e) => setY1(e.target.value)}
            placeholder={mode === "before" ? "2001" : mode === "after" ? "2010" : "1996"}
            className="border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white w-[120px]"
          />
        )}
        {mode === "between" && (
          <>
            <span className="self-center text-sm text-[color:var(--muted)]">and</span>
            <input
              type="number"
              value={y2}
              onChange={(e) => setY2(e.target.value)}
              placeholder="2010"
              className="border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white w-[120px]"
            />
          </>
        )}
      </div>

      <input type="hidden" name="yearFrom" value={yearFrom ?? ""} />
      <input type="hidden" name="yearTo" value={yearTo ?? ""} />
    </div>
  );
}
