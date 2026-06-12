/**
 * Pill row shown on the deep-dive group page, top-right of the
 * header. Lets the user hop between the three group lenses
 * (Background · Location · Career) without going back to the
 * snapshot landing.
 */

import Link from "next/link";

export type LensId = "background" | "location" | "career";

interface Lens {
  id: LensId;
  label: string;
}

interface Props {
  lenses: Lens[];
  active: LensId;
}

export function SnapshotLensSwitcher({ lenses, active }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {lenses.map((l) => {
        const on = l.id === active;
        return (
          <Link
            key={l.id}
            href={`/directory/snapshot?lens=${l.id}`}
            className={`inline-flex items-center gap-[7px] text-[13px] font-semibold rounded-full px-[15px] py-[8px] whitespace-nowrap transition-all duration-[140ms] ${
              on
                ? "bg-white text-navy"
                : "text-white/[.82] hover:text-white"
            }`}
            style={
              on
                ? { border: "1px solid #fff" }
                : {
                    background: "rgba(255,255,255,.08)",
                    border: "1px solid rgba(255,255,255,.22)",
                  }
            }
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
