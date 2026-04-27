"use client";
import type { PhotoStats } from "@/lib/event-photos/types";

export function DownloadButtons({ eventId, stats }: { eventId: number; stats: PhotoStats }) {
  const link = (status: "all" | "approved" | "pending" | "rejected", count: number, label: string) => {
    const href = `/api/admin/event-photos/download-zip?eventId=${eventId}&status=${status}`;
    const disabled = count === 0;
    return (
      <a
        key={status}
        href={disabled ? undefined : href}
        aria-disabled={disabled}
        className={`text-xs font-semibold px-3 py-1.5 rounded border ${
          disabled
            ? "border-[color:var(--rule)] text-[color:var(--muted)] cursor-not-allowed"
            : "border-navy text-navy hover:bg-navy hover:text-white"
        }`}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
      >
        {label} ({count})
      </a>
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      {link("all", stats.total, "ZIP all")}
      {link("approved", stats.approved, "ZIP approved")}
      {link("pending", stats.pending, "ZIP pending")}
    </div>
  );
}
