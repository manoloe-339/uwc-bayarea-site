"use client";
import Link from "next/link";
import type { PhotoFilter } from "@/lib/event-photos/types";
import type { PhotoStats } from "@/lib/event-photos/types";

const BASE_TABS: { key: PhotoFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "duplicates", label: "Duplicates" },
];

export function PhotoFilterTabs({
  active,
  basePath,
  stats,
  showDistributed,
}: {
  active: PhotoFilter;
  basePath: string;
  stats: PhotoStats;
  showDistributed?: boolean;
}) {
  const tabs = showDistributed
    ? [...BASE_TABS, { key: "distributed" as PhotoFilter, label: "Distributed" }]
    : BASE_TABS;
  const counts: Record<PhotoFilter, number> = {
    all: stats.total,
    pending: stats.pending,
    approved: stats.approved,
    rejected: stats.rejected,
    duplicates: stats.duplicates,
    distributed: stats.distributed,
  };
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[color:var(--rule)] mb-4">
      {tabs.map((t) => {
        const isActive = active === t.key;
        const href = t.key === "all" ? basePath : `${basePath}?filter=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              isActive
                ? "border-navy text-navy font-semibold"
                : "border-transparent text-[color:var(--muted)] hover:text-navy"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[11px] text-[color:var(--muted)]">({counts[t.key]})</span>
          </Link>
        );
      })}
    </div>
  );
}
