"use client";

import { useState } from "react";
import { type LoginTile, tileBackground } from "./faces-shared";

interface Props {
  tile: LoginTile;
  /** Square corners (Mosaic) vs perfectly round (Living Wall,
   * Constellation). */
  square?: boolean;
  /** Extra classes (sizing / positioning). */
  className?: string;
  /** Inline style (rings, shadows, size). Spread LAST so callers can
   * override the defaults. */
  style?: React.CSSProperties;
  /** Hide the tooltip — Mosaic does this to avoid 120 hover bubbles. */
  noTitle?: boolean;
  /** Pixel width to request from Vercel Image Optimization. Backdrops
   * pass a size matched to where the tile renders so we don't pull
   * 450x450 JPEGs to fill a 110px circle. */
  imgWidth?: number;
}

/** Build a `/_next/image?...` URL so Vercel resizes the source on the
 * fly. Source must be a host that's whitelisted in next.config's
 * images.remotePatterns. Local /public assets pass through unchanged
 * — Next won't double-optimize an SVG anyway. q=70 is a good size
 * vs. quality tradeoff for the small tile sizes we render at. */
function optimized(url: string, width: number): string {
  // SVGs are vector — Next.js skips optimization for them, so just
  // return the raw URL. Same for absolute paths under /flags/ etc.
  if (url.endsWith(".svg")) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=70`;
}

/**
 * Renders any kind of LoginTile. Every variant fills the tile edge to
 * edge — no inset, no white frame — so the asset reads at a glance.
 * Image-load failures fall back to monogram text (photos / orgs) or
 * a typography-only tile (UWCs).
 */
export default function Tile({
  tile,
  square,
  className,
  style,
  noTitle,
  imgWidth = 256,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  const radius = square ? "18%" : "50%";
  const wrapStyle: React.CSSProperties = {
    borderRadius: radius,
    overflow: "hidden",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    containerType: "size",
    ...style,
  };
  const wrapClass = (className ?? "") + " select-none";

  // ----- Flag tile. Round tiles (Living Wall, Constellation) use the
  // circle-flag SVG from /flags/{iso}.svg. Square tiles (Mosaic) use
  // the rectangular 4x3 SVG from /flags/sq/{iso}.svg with object-fit
  // cover so it fills the square edge to edge — a round flag inside a
  // square tile looked wrong (donut of navy around the disc).
  if (tile.kind === "flag") {
    const flagUrl = square
      ? `/flags/sq/${tile.iso.toLowerCase()}.svg`
      : tile.svgUrl;
    return (
      <div
        className={wrapClass}
        style={{
          ...wrapStyle,
          background: "linear-gradient(155deg, #0d5099, #06223f)",
        }}
        title={noTitle ? undefined : tile.label}
        aria-label={tile.label}
      >
        {!imgFailed ? (
          <img
            src={flagUrl}
            alt={tile.label}
            onError={() => setImgFailed(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "44cqmin",
              color: "#fff",
              lineHeight: 1,
              letterSpacing: ".06em",
            }}
          >
            {tile.iso}
          </span>
        )}
      </div>
    );
  }

  // ----- UWC tile: logo on white. Uses object-fit: CONTAIN with a
  // small inset (92%) — UWC logos vary in shape (some are square
  // icon marks, some are wide wordmarks like "UWC USA") so we can't
  // safely cover-crop. Contain shows the logo cleanly at the cost of
  // a small white margin.
  if (tile.kind === "uwc") {
    return (
      <div
        className={wrapClass}
        style={{ ...wrapStyle, background: "#fff" }}
        title={noTitle ? undefined : tile.label}
      >
        <img
          src={optimized(tile.imgUrl, imgWidth)}
          alt={tile.label}
          onError={() => setImgFailed(true)}
          style={{
            width: "92%",
            height: "92%",
            objectFit: "contain",
            objectPosition: "center",
            opacity: imgFailed ? 0 : 1,
          }}
        />
      </div>
    );
  }

  // ----- Org tile: company / non-UWC university logo, contained
  // with a small inset (same logic as UWC — wordmark vs square-mark
  // shapes vary).
  if (tile.kind === "org") {
    const hasImage = !!tile.imgUrl && !imgFailed;
    return (
      <div
        className={wrapClass}
        style={{
          ...wrapStyle,
          background: hasImage
            ? "#fff"
            : "linear-gradient(155deg, #e7d3bf, #c49b78)",
        }}
        title={noTitle ? undefined : tile.label}
      >
        {hasImage ? (
          <img
            src={optimized(tile.imgUrl as string, imgWidth)}
            alt={tile.label}
            onError={() => setImgFailed(true)}
            style={{
              width: "92%",
              height: "92%",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "Fraunces, Georgia, serif",
              fontWeight: 700,
              fontSize: "44cqmin",
              color: "var(--navy)",
              lineHeight: 1,
            }}
          >
            {tile.initials}
          </span>
        )}
      </div>
    );
  }

  // ----- Photo tile: alumni headshot with monogram fallback.
  const photoBg = tileBackground(tile.tone);
  const hasImage = !!tile.imgUrl && !imgFailed;
  return (
    <div
      className={wrapClass}
      style={{ ...wrapStyle, background: photoBg }}
      title={noTitle ? undefined : tile.label}
    >
      {hasImage && (
        <img
          src={optimized(tile.imgUrl as string, imgWidth)}
          alt={tile.label}
          onError={() => setImgFailed(true)}
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      )}
      {!hasImage && (
        <span
          style={{
            fontWeight: 700,
            fontSize: "36cqmin",
            lineHeight: 1,
            color: "rgba(255,255,255,.94)",
            textShadow: "0 1px 3px rgba(11,37,69,.32)",
          }}
        >
          {tile.initials}
        </span>
      )}
    </div>
  );
}
