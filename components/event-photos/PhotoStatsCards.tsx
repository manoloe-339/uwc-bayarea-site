import type { PhotoStats } from "@/lib/event-photos/types";

export function PhotoStatsCards({ stats }: { stats: PhotoStats }) {
  const cards: { label: string; value: number; tone: string }[] = [
    { label: "Total", value: stats.total, tone: "text-[color:var(--navy-ink)]" },
    { label: "Approved", value: stats.approved, tone: "text-emerald-700" },
    { label: "Pending", value: stats.pending, tone: "text-amber-700" },
    { label: "Rejected", value: stats.rejected, tone: "text-rose-700" },
    { label: "Duplicates", value: stats.duplicates, tone: "text-slate-600" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
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
