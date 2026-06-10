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

  // ----- Flag tile: full-bleed circle-flag SVG (or rectangular SVG
  // cover-cropped in Mosaic).
  if (tile.kind === "flag") {
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
            src={tile.svgUrl}
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

  // ----- UWC tile: logo full-bleed on white. Always has imgUrl —
  // buildUwcTiles only emits rows with a logo.
  if (tile.kind === "uwc") {
    return (
      <div
        className={wrapClass}
        style={{ ...wrapStyle, background: "#fff" }}
        title={noTitle ? undefined : tile.label}
      >
        <img
          src={tile.imgUrl}
          alt={tile.label}
          onError={() => setImgFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            opacity: imgFailed ? 0 : 1,
          }}
        />
      </div>
    );
  }

  // ----- Org tile: company / non-UWC university logo, full-bleed.
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
            src={tile.imgUrl as string}
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
          src={tile.imgUrl as string}
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
