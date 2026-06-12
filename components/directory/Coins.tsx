/**
 * Small circular "coin" presentations used inside cards: the UWC
 * college mark and country flags. Both follow the same visual
 * vocabulary — 20px circle, hairline rule outside, edge-to-edge
 * imagery clipped inside.
 *
 * Pure server components — no runtime dependency on React state.
 */

interface UwcCoinProps {
  /** Resolved logo URL from the uwc_assets table. Falls back to the
   * campus initial when missing. */
  logoUrl?: string | null;
  /** Display campus name ("Atlantic College"); used for the initial
   * fallback and the alt text. */
  campusName: string;
  size?: number;
}

export function UwcCoin({ logoUrl, campusName, size = 20 }: UwcCoinProps) {
  const initial = (campusName.trim()[0] ?? "").toUpperCase();
  const style = { width: size, height: size };
  if (logoUrl) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full overflow-hidden bg-white shrink-0 ring-1 ring-[color:var(--rule)]"
        style={style}
        aria-label={campusName}
        title={campusName}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-white shrink-0 ring-1 ring-[color:var(--rule)] font-display font-bold text-navy"
      style={{ ...style, fontSize: Math.round(size * 0.48), fontFamily: "Fraunces, Georgia, serif" }}
      aria-label={campusName}
      title={campusName}
    >
      {initial}
    </span>
  );
}

interface FlagCoinProps {
  iso: string;
  /** Resolved flag URL + display name from the country_flags lookup.
   * When the ISO is unknown we render a navy filler coin so the row
   * doesn't shift. */
  flag?: { name: string; url: string };
  size?: number;
}

export function FlagCoin({ iso, flag, size = 20 }: FlagCoinProps) {
  const style = { width: size, height: size };
  if (!flag) {
    return (
      <span
        className="inline-block rounded-full bg-[color:var(--navy-ink)] shrink-0 ring-1 ring-[color:var(--rule)]"
        style={style}
        aria-label={iso}
      />
    );
  }
  return (
    <span
      className="inline-flex rounded-full overflow-hidden bg-[color:var(--navy-ink)] shrink-0 ring-1 ring-[color:var(--rule)]"
      style={style}
      aria-label={flag.name}
      title={flag.name}
    >
      {/* SVG flag, 4:3, cropped to a circle via object-cover. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={flag.url}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </span>
  );
}

/** Rectangular variant — the source SVGs are 4:3 already, so this
 * shows the full flag instead of clipping to a circle. Use in lists
 * where the natural shape reads better than a coin. */
interface FlagRectProps {
  iso: string;
  flag?: { name: string; url: string };
  /** Width in px. Height is computed at 3/4 (4:3 aspect). */
  width?: number;
}

export function FlagRect({ iso, flag, width = 24 }: FlagRectProps) {
  const height = Math.round((width * 3) / 4);
  const style = { width, height };
  if (!flag) {
    return (
      <span
        className="inline-block rounded-[2px] bg-[color:var(--navy-ink)] shrink-0 ring-1 ring-[color:var(--rule)]"
        style={style}
        aria-label={iso}
      />
    );
  }
  return (
    <span
      className="inline-flex rounded-[2px] overflow-hidden bg-[color:var(--navy-ink)] shrink-0 ring-1 ring-[color:var(--rule)]"
      style={style}
      aria-label={flag.name}
      title={flag.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={flag.url}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </span>
  );
}

interface FlagCoinsProps {
  isos: string[];
  flags: Record<string, { name: string; url: string }>;
  size?: number;
  /** When provided, each coin renders as a real link — used to make
   * flags act as filter links into /directory?origin=… */
  linkBuilder?: (iso: string) => string;
}

/** Render a row of overlapping flag coins (max 3). Use when an alum
 * lists more than one origin country. */
export function FlagCoins({
  isos,
  flags,
  size = 20,
  linkBuilder,
}: FlagCoinsProps) {
  return (
    <span className="inline-flex align-middle">
      {isos.map((iso, i) => {
        const flag = flags[iso.toLowerCase()];
        const inner = <FlagCoin iso={iso} flag={flag} size={size} />;
        const wrapClass = "inline-flex";
        const style = { marginLeft: i === 0 ? 0 : -6 };
        if (linkBuilder) {
          return (
            <a
              key={iso + i}
              href={linkBuilder(iso)}
              style={style}
              className={`${wrapClass} hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy rounded-full`}
              aria-label={`Search for alumni from ${flag?.name ?? iso.toUpperCase()}`}
            >
              {inner}
            </a>
          );
        }
        return (
          <span key={iso + i} style={style} className={wrapClass}>
            {inner}
          </span>
        );
      })}
    </span>
  );
}
