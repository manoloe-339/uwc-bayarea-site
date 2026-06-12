/**
 * Top-5 "facet" card on the Snapshot view. Lucide icon + tracked-
 * uppercase title in the header, total to the right, then up to 5
 * rows of label · count with a magnitude bar underneath each. Every
 * row is a Link into the directory with the corresponding filter.
 *
 * Pure server-rendered.
 */

import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export interface FacetRow {
  label: string;
  count: number;
  href: string;
}

interface Props {
  /** Anchor id (e.g. "origin") so other tiles can scroll-link here. */
  id?: string;
  icon: IconName;
  title: string;
  /** The total count across the whole population for this facet —
   * shown to the right of the title. */
  total: number;
  /** Up to 5 top rows. */
  rows: FacetRow[];
}

export function SnapshotFacetCard({ id, icon, title, total, rows }: Props) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <div
      id={id}
      className="bg-white rounded-[16px] p-[18px_20px_14px]"
      style={{
        boxShadow:
          "0 2px 0 rgba(2,28,56,.35), 0 26px 50px -32px rgba(0,0,0,.6)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-[7px] text-navy">
          <Icon name={icon} size={14} strokeWidth={2} />
          <span
            className="font-bold uppercase whitespace-nowrap"
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 11,
              letterSpacing: ".16em",
            }}
          >
            {title}
          </span>
        </span>
        <span className="text-[12px] text-[color:var(--muted-2)]">
          {total} total
        </span>
      </div>
      <div>
        {rows.slice(0, 5).map((r) => (
          <Link
            key={`${r.label}-${r.count}`}
            href={r.href}
            className="block py-[7px] group"
          >
            <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3">
              <span className="text-[14px] text-[color:var(--navy-ink)] truncate group-hover:text-navy">
                {r.label}
              </span>
              <span className="text-navy font-bold text-[13px] tabular-nums">
                {r.count}
              </span>
            </div>
            <div className="h-[5px] rounded-full bg-[rgba(11,37,69,.08)] overflow-hidden mt-[5px]">
              <div
                className="h-full bg-navy"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
