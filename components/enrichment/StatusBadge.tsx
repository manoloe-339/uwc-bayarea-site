import type { EnrichmentStatus } from "@/types/enrichment";

type Props = {
  status: EnrichmentStatus;
  enrichedAt?: string | Date | null;
  error?: string | null;
  /** Compact: smaller chip suitable for inline-with-name use. */
  compact?: boolean;
};

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STYLES: Record<NonNullable<EnrichmentStatus>, { label: string; cls: string }> = {
  complete: {
    label: "✓ Enriched",
    cls: "bg-green-50 border-green-200 text-green-800",
  },
  pending: {
    label: "⏳ Enriching",
    cls: "bg-yellow-50 border-yellow-200 text-yellow-800",
  },
  needs_review: {
    label: "⚠ Needs review",
    cls: "bg-orange-50 border-orange-200 text-orange-800",
  },
  failed: {
    label: "✗ Failed",
    cls: "bg-red-50 border-red-200 text-red-800",
  },
};

export function EnrichmentStatusBadge({ status, enrichedAt, error, compact }: Props) {
  if (!status) return null;
  const cfg = STYLES[status];
  const tooltipParts = [
    enrichedAt ? `As of ${fmtDate(enrichedAt)}` : null,
    error ? error : null,
  ].filter(Boolean);
  const sizeCls = compact
    ? "text-[10px] px-1.5 py-0.5"
    : "text-xs px-2 py-0.5";
  return (
    <span
      title={tooltipParts.length ? tooltipParts.join(" — ") : undefined}
      className={`inline-flex items-center rounded border uppercase tracking-wider font-bold whitespace-nowrap ${sizeCls} ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}
