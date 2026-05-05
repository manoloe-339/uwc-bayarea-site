import type { PulseTile } from "@/lib/dashboard-signals";

const TONE_BG: Record<PulseTile["deltaTone"], string> = {
  default: "bg-white border-[color:var(--rule)]",
  amber: "bg-[rgba(180,83,9,0.04)] border-[rgba(180,83,9,0.25)]",
  red: "bg-[rgba(190,18,60,0.04)] border-[rgba(190,18,60,0.35)]",
};

function deltaColor(tile: PulseTile): string {
  if (tile.deltaTone === "amber") return "text-[#B45309]";
  if (tile.deltaTone === "red") return "text-[#BE123C]";
  if (tile.deltaDir === "up") return "text-[#047857]";
  if (tile.deltaDir === "down") return "text-[#9F1239]";
  return "text-[color:var(--muted)]";
}

function arrow(tile: PulseTile): string {
  if (tile.deltaDir === "up") return "↑";
  if (tile.deltaDir === "down") return "↓";
  return "→";
}

export function PulseRow({ tiles }: { tiles: PulseTile[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      {tiles.map((t) => (
        <div
          key={t.id}
          className={`border rounded-[10px] px-4 py-3.5 sm:px-[18px] sm:py-4 font-sans ${TONE_BG[t.deltaTone]}`}
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
            {t.label}
          </div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] leading-none text-[color:var(--navy-ink)]">
              {t.value}
            </span>
            {t.delta && (
              <span className={`text-xs font-semibold ${deltaColor(t)}`}>
                {arrow(t)} {t.delta}
              </span>
            )}
          </div>
          {t.footnote && (
            <div className="mt-2 text-xs text-[color:var(--muted)] leading-[1.45]">
              {t.footnote}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
