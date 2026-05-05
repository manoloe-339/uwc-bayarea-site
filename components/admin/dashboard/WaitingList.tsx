import Link from "next/link";
import type { WaitingRow } from "@/lib/dashboard-signals";

export function WaitingList({ rows }: { rows: WaitingRow[] }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((a, r) => a + r.count, 0);

  return (
    <section className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden font-sans">
      <header className="px-4 sm:px-5 py-3 border-b border-[color:var(--rule)] flex items-center justify-between">
        <span className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
          People waiting on you
        </span>
        <span className="text-[11px] text-[color:var(--muted)]">{total} total</span>
      </header>
      <ul className="list-none m-0 p-0">
        {rows.map((r, i) => {
          const red = r.tone === "red";
          return (
            <li
              key={r.id}
              className={`${i === 0 ? "" : "border-t border-[color:var(--rule)]"} ${
                red ? "bg-[rgba(190,18,60,0.04)]" : "bg-white"
              }`}
            >
              <Link
                href={r.href}
                className={`flex items-center justify-between gap-3 px-4 sm:px-5 py-3 no-underline ${
                  red ? "text-[#9F1239]" : "text-[color:var(--navy-ink)]"
                }`}
              >
                <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap min-w-0">
                  <span
                    className={`text-[18px] sm:text-[20px] font-bold tracking-[-0.01em] leading-none min-w-[28px] ${
                      red ? "text-[#BE123C]" : "text-[color:var(--navy-ink)]"
                    }`}
                  >
                    {r.count}
                  </span>
                  <span className="text-[13px] sm:text-[14px] font-semibold">
                    {r.label}
                  </span>
                  <span
                    className={`hidden sm:inline text-xs ${
                      red ? "text-[rgba(159,18,57,0.8)]" : "text-[color:var(--muted)]"
                    }`}
                  >
                    · {r.meta}
                  </span>
                </div>
                <span
                  className={`hidden sm:inline text-xs font-semibold tracking-[0.04em] ${
                    red ? "text-[#BE123C]" : "text-navy"
                  }`}
                >
                  Open ›
                </span>
                <span
                  className={`sm:hidden text-[18px] ${red ? "text-[#BE123C]" : "text-[color:var(--muted)]"}`}
                >
                  ›
                </span>
              </Link>
              <div
                className={`sm:hidden px-4 pb-2.5 text-[11px] ${
                  red ? "text-[rgba(159,18,57,0.8)]" : "text-[color:var(--muted)]"
                }`}
              >
                {r.meta}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
