import Link from "next/link";
import { SnoozePopover } from "./SnoozePopover";
import type { Severity } from "@/lib/dashboard-signals";

const SEV_BORDER: Record<Severity, string> = {
  grey: "border-[color:var(--rule)] [border-left-color:rgba(11,37,69,0.32)]",
  amber: "border-[rgba(180,83,9,0.45)] [border-left-color:#B45309]",
  red: "border-[rgba(190,18,60,0.55)] [border-left-color:#BE123C]",
};

const SEV_PILL: Record<Severity, { label: string; classes: string } | null> = {
  grey: null,
  amber: {
    label: "Due soon",
    classes: "bg-[rgba(180,83,9,0.10)] text-[#92400E]",
  },
  red: {
    label: "Overdue",
    classes: "bg-[rgba(190,18,60,0.10)] text-[#9F1239]",
  },
};

export function DashboardCard({
  signalId,
  severity,
  eyebrow,
  eyebrowMeta,
  title,
  meta,
  body,
  primaryAction,
  secondaryAction,
  checklist,
}: {
  signalId: string;
  severity: Severity;
  eyebrow: string;
  eyebrowMeta?: string;
  title: string;
  meta?: { label: string; value: string }[];
  body?: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  checklist?: { label: string; done: boolean; next?: boolean }[];
}) {
  const pill = SEV_PILL[severity];
  return (
    <article
      className={`relative bg-white rounded-[10px] border border-l-[3px] p-4 sm:p-[18px_20px_16px] font-sans text-[color:var(--navy-ink)] ${SEV_BORDER[severity]}`}
    >
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2.5 mb-2.5">
        <div className="flex items-center flex-wrap gap-2 min-w-0">
          <span className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
            {eyebrow}
          </span>
          {pill && (
            <span
              className={`text-[10px] tracking-[.14em] uppercase font-bold rounded-full px-1.5 py-0.5 ${pill.classes}`}
            >
              {pill.label}
            </span>
          )}
        </div>
        {eyebrowMeta && (
          <span className="text-[11px] text-[color:var(--muted)] sm:whitespace-nowrap">
            {eyebrowMeta}
          </span>
        )}
      </header>

      <h3 className="text-[17px] sm:text-[19px] font-semibold tracking-[-0.005em] leading-[1.25] m-0 mb-2 text-[color:var(--navy-ink)]">
        {title}
      </h3>

      {meta && meta.length > 0 && (
        <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-xs text-[color:var(--muted)]">
          {meta.map((m) => (
            <span key={m.label} className="inline-flex items-baseline gap-1.5">
              <span className="text-[10px] tracking-[.18em] uppercase font-bold text-navy">
                {m.label}
              </span>
              <span className="text-[12.5px] font-medium text-[color:var(--navy-ink)]">
                {m.value}
              </span>
            </span>
          ))}
        </div>
      )}

      {checklist && checklist.length > 0 && (
        <ul className="list-none p-0 m-0 mt-3 flex flex-col gap-1.5">
          {checklist.map((it) => (
            <li
              key={it.label}
              className={`flex items-center gap-2.5 text-[13px] ${
                it.done
                  ? "text-[color:var(--muted)]"
                  : it.next
                    ? "font-semibold text-[color:var(--navy-ink)]"
                    : "text-[color:var(--navy-ink)]"
              }`}
            >
              <span
                className={`shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded-[3px] text-white text-[10px] font-bold leading-none ${
                  it.done ? "bg-navy border border-navy" : "bg-white border border-[color:var(--rule)]"
                }`}
              >
                {it.done ? "✓" : ""}
              </span>
              <span
                className={
                  it.done
                    ? "line-through decoration-[rgba(11,37,69,0.3)]"
                    : ""
                }
              >
                {it.label}
              </span>
              {it.next && (
                <span className="ml-auto text-[10px] tracking-[.14em] uppercase font-bold text-navy bg-[rgba(2,101,168,0.08)] px-1.5 py-0.5 rounded">
                  Next
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {body && (
        <p className="mt-2.5 text-[13.5px] leading-[1.55] text-[color:var(--muted)] m-0">
          {body}
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5 justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            href={primaryAction.href}
            className="bg-navy text-white border-0 rounded-md px-3.5 py-2 text-[13px] font-semibold no-underline"
          >
            {primaryAction.label}
          </Link>
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="bg-white text-[color:var(--navy-ink)] border border-[color:var(--rule)] rounded-md px-3 py-2 text-[13px] font-semibold no-underline hover:border-navy"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
        <SnoozePopover signalId={signalId} />
      </div>
    </article>
  );
}
