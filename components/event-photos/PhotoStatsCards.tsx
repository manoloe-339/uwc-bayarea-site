import type { PhotoStats } from "@/lib/event-photos/types";

export function PhotoStatsCards({
  stats,
  showDistributed,
}: {
  stats: PhotoStats;
  showDistributed?: boolean;
}) {
  const cards: { label: string; value: number; tone: string }[] = [
    { label: "Total", value: stats.total, tone: "text-[color:var(--navy-ink)]" },
    { label: "Approved", value: stats.approved, tone: "text-emerald-700" },
    { label: "Pending", value: stats.pending, tone: "text-amber-700" },
    { label: "Rejected", value: stats.rejected, tone: "text-rose-700" },
    { label: "Duplicates", value: stats.duplicates, tone: "text-slate-600" },
  ];
  if (showDistributed) {
    cards.push({ label: "Distributed", value: stats.distributed, tone: "text-navy" });
  }
  return (
    <div className={`grid grid-cols-2 ${showDistributed ? "sm:grid-cols-6" : "sm:grid-cols-5"} gap-3 mb-6`}>
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4"
        >
          <div className="text-[11px] tracking-[.12em] uppercase text-[color:var(--muted)]">
            {c.label}
          </div>
          <div className={`mt-1 font-sans text-2xl font-bold ${c.tone}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
