"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export interface DeepDiveRow {
  /** Stable key for React. */
  key: string;
  label: string;
  count: number;
  href: string;
  /** Optional leading mark — logo, flag coin, or initial tile. */
  avatar?: ReactNode;
}

interface Props {
  icon: IconName;
  title: string;
  total: number;
  rows: DeepDiveRow[];
  /** Rows shown before the "Show N more" affordance. Default 8. */
  defaultRows?: number;
}

/**
 * Wider sibling of SnapshotFacetCard used inside the drill-down
 * Deep-dive groups. Shows up to `defaultRows` rows by default with a
 * Show-more / Show-less expander, each row optionally preceded by a
 * small avatar/logo/flag. Magnitude bar under each row scales to the
 * tallest visible count.
 */
export function DeepDiveFacetCard({
  icon,
  title,
  total,
  rows,
  defaultRows = 8,
}: Props) {
  const [open, setOpen] = useState(false);
  const shown = open ? rows : rows.slice(0, defaultRows);
  const max = shown.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const more = rows.length - defaultRows;

  return (
    <div
      className="bg-white rounded-[16px] flex flex-col text-[color:var(--navy-ink)] p-[18px_20px_12px]"
      style={{
        boxShadow:
          "0 2px 0 rgba(2,28,56,.35), 0 26px 50px -32px rgba(0,0,0,.6)",
      }}
    >
      <div className="flex items-center justify-between gap-[10px] mb-2 pb-3 border-b border-[color:var(--rule)]">
        <span className="inline-flex items-center gap-2 text-navy text-[11px] font-bold tracking-[.15em] uppercase whitespace-nowrap">
          <Icon name={icon} size={14} strokeWidth={2} />
          {title}
        </span>
        <span className="text-[12px] text-[color:var(--muted-2)] whitespace-nowrap">
          {total} {total === 1 ? "value" : "values"}
        </span>
      </div>
      <div>
        {shown.map((r) => (
          <Link
            key={r.key}
            href={r.href}
            className="block py-[8px] -mx-[10px] px-[10px] rounded-[8px] hover:bg-[rgba(2,101,168,.05)] group"
          >
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-[11px]">
              {r.avatar ?? <span className="w-0" />}
              <span className="text-[14px] text-[color:var(--navy-ink)] truncate group-hover:text-navy">
                {r.label}
              </span>
              <span className="text-navy font-bold text-[13px] tabular-nums min-w-[30px] text-right">
                {r.count}
              </span>
            </div>
            <div className="h-[5px] rounded-full bg-[rgba(11,37,69,.08)] overflow-hidden mt-[2px]">
              <div
                className="h-full bg-navy"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
      {more > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between mt-[10px] pt-[12px] border-t border-[color:var(--rule)] text-navy text-[13px] font-semibold hover:text-navy-2"
        >
          <span>{open ? "Show less" : `Show ${more} more`}</span>
          <Icon
            name="chevron-down"
            size={14}
            strokeWidth={2}
            className={open ? "rotate-180 transition-transform" : "transition-transform"}
          />
        </button>
      )}
    </div>
  );
}
