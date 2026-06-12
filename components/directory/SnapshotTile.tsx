/**
 * Headline image tile on the Snapshot view. Full-bleed image with a
 * dark scrim, top-left eyebrow, bottom-left headline + label. Whole
 * tile is a single Link into the directory pre-filtered to that
 * value. Server-rendered.
 */

import Link from "next/link";
import { Icon, type IconName } from "./Icon";

interface Props {
  href: string;
  eyebrow: string;
  headline: string;
  label: string;
  /** When set, used as the tile background image. When null/undefined,
   * a navy gradient + the supplied fallback icon are shown instead. */
  imageUrl?: string | null;
  /** Lucide icon used when no image is supplied. */
  fallbackIcon: IconName;
}

export function SnapshotTile({
  href,
  eyebrow,
  headline,
  label,
  imageUrl,
  fallbackIcon,
}: Props) {
  return (
    <Link
      href={href}
      className="relative block min-h-[165px] sm:min-h-[180px] rounded-[14px] overflow-hidden transition-transform duration-200 hover:-translate-y-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      style={{
        boxShadow:
          "0 2px 0 rgba(2,28,56,.35), 0 22px 44px -30px rgba(0,0,0,.55)",
      }}
    >
      {/* Background — real image when supplied, navy gradient + icon
          fallback when not. */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-white/40"
          style={{
            background:
              "radial-gradient(135% 110% at 70% 4%, #2f7fce 0%, #004A97 60%, #06203f 100%)",
          }}
        >
          <Icon name={fallbackIcon} size={64} strokeWidth={1.4} />
        </div>
      )}
      {/* Bottom scrim — readable text over any image. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(7,24,46,.9), rgba(7,24,46,.1) 62%)",
        }}
      />
      <span
        className="absolute top-[13px] left-[16px] right-[16px] text-white/85 truncate"
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 10,
          letterSpacing: ".18em",
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </span>
      <div className="absolute left-[16px] right-[16px] bottom-[14px] text-white">
        <div
          className="leading-[1.04] tracking-[-.01em]"
          style={{
            fontFamily: "Fraunces, Georgia, serif",
            fontWeight: 700,
            fontSize: 23,
          }}
        >
          {headline}
        </div>
        <div className="text-[13px] text-white/[.92] mt-[2px]">{label}</div>
      </div>
    </Link>
  );
}
