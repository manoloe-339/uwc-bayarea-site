/**
 * One of the three "Browse by area" cards on /directory/snapshot.
 * Eyebrow + name + lead stat + chip row + animated arrow. Flat
 * navy-translucent card — no imagery (design system choice: imagery
 * lives only in the 4 headline image tiles above).
 *
 * Whole card is a Link to /directory/snapshot?lens=<id>.
 */

import Link from "next/link";
import { Icon } from "./Icon";

interface Props {
  href: string;
  eyebrow: string;
  name: string;
  leadStat: string;
  chips: string[];
}

export function DeepDiveNavCard({
  href,
  eyebrow,
  name,
  leadStat,
  chips,
}: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[14px] p-[18px] cursor-pointer transition-all duration-150 hover:-translate-y-[2px]"
      style={{
        background: "rgba(255,255,255,.07)",
        border: "1px solid rgba(255,255,255,.16)",
      }}
    >
      <div className="flex items-center justify-end mb-[13px]">
        <span
          className="inline-grid place-items-center w-[30px] h-[30px] rounded-full bg-white/[.14] text-white transition-all duration-150 group-hover:translate-x-[3px] group-hover:bg-white group-hover:text-navy"
        >
          <Icon
            name="arrow-left"
            size={15}
            strokeWidth={2}
            className="rotate-180"
          />
        </span>
      </div>
      <div className="text-[10px] font-extrabold tracking-[.2em] uppercase text-white/60">
        {eyebrow}
      </div>
      <div
        className="text-white leading-[1.05] mt-[3px]"
        style={{
          fontFamily: "Fraunces, Georgia, serif",
          fontWeight: 700,
          fontSize: 22,
        }}
      >
        {name}
      </div>
      <div className="text-white/[.72] text-[13px] mt-[6px] leading-[1.4]">
        {leadStat}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-[6px] mt-[13px]">
          {chips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center text-[11.5px] font-semibold text-white/[.92] rounded-full px-[11px] py-[4px] whitespace-nowrap"
              style={{
                background: "rgba(255,255,255,.13)",
                border: "1px solid rgba(255,255,255,.2)",
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
