"use client";

import { useState } from "react";
import { type LoginTile, tileBackground } from "./faces-shared";

interface Props {
  tile: LoginTile;
  /** Round (face) or square (mosaic / logo). The Living Wall and
   * Constellation always pass false; Mosaic always passes true. */
  square?: boolean;
  /** Optional CSS class for sizing / positioning. */
  className?: string;
  /** Optional inline style for size + extra effects (ring, shadow). */
  style?: React.CSSProperties;
  /** Hide the name tooltip — useful in the Mosaic where 120 tooltips
   * become noise on hover. */
  noTitle?: boolean;
}

/**
 * Renders any kind of LoginTile — photo, UWC, org logo, or flag —
 * with consistent shape and a graceful image-load fallback.
 *
 * For photo/uwc/org tiles with `imgUrl`, an <img> covers the tile and
 * we drop back to monogram (photo: initials; uwc: short name; org:
 * initials) if the image errors. For flag tiles, a large emoji is
 * centered on the deep-blue UWC palette.
 */
export default function Tile({ tile, square, className, style, noTitle }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  const radius = square ? "18%" : "50%";
  const baseClass =
    "relative flex items-center justify-center overflow-hidden " +
    (className ?? "");

  // Flag tile — deep-blue background, big emoji
  if (tile.kind === "flag") {
    return (
      <div
        className={baseClass}
        style={{
          borderRadius: radius,
          background: "linear-gradient(155deg, #0d5099, #06223f)",
          containerType: "size",
          ...style,
        }}
        title={noTitle ? undefined : tile.label}
        aria-label={tile.label}
      >
        <span
          style={{
            fontSize: "60cqmin",
            lineHeight: 1,
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,.35))",
          }}
        >
          {tile.emoji}
        </span>
      </div>
    );
  }

  // UWC tile — logo on white if available, otherwise icon on tinted
  // gradient with the school's short name.
  if (tile.kind === "uwc") {
    const hasImage = !!tile.imgUrl && !imgFailed;
    return (
      <div
        className={baseClass}
        style={{
          borderRadius: radius,
          background: hasImage
            ? "#fff"
            : "linear-gradient(155deg, #2f7fce, #004A97)",
          boxShadow: hasImage ? "inset 0 0 0 1px rgba(11,37,69,.1)" : undefined,
          containerType: "size",
          ...style,
        }}
        title={noTitle ? undefined : tile.label}
      >
        {hasImage ? (
          <img
            src={tile.imgUrl as string}
            alt={tile.label}
            onError={() => setImgFailed(true)}
            style={{
              width: "82%",
              height: "82%",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
        ) : (
          <>
            <span style={{ fontSize: "44cqmin", lineHeight: 1 }} aria-hidden>
              {tile.icon}
            </span>
            <span
              style={{
                position: "absolute",
                bottom: "8%",
                fontSize: "14cqmin",
                lineHeight: 1,
                fontWeight: 700,
                color: "rgba(255,255,255,.86)",
                letterSpacing: ".06em",
                textTransform: "uppercase",
                textShadow: "0 1px 3px rgba(11,37,69,.5)",
              }}
            >
              {tile.short}
            </span>
          </>
        )}
      </div>
    );
  }

  // Org tile — company / non-UWC university logo on white with
  // monogram fallback.
  if (tile.kind === "org") {
    const hasImage = !!tile.imgUrl && !imgFailed;
    return (
      <div
        className={baseClass}
        style={{
          borderRadius: radius,
          background: hasImage
            ? "#fff"
            : "linear-gradient(155deg, #e7d3bf, #c49b78)",
          boxShadow: hasImage ? "inset 0 0 0 1px rgba(11,37,69,.1)" : undefined,
          containerType: "size",
          ...style,
        }}
        title={noTitle ? undefined : tile.label}
      >
        {hasImage ? (
          <img
            src={tile.imgUrl as string}
            alt={tile.label}
            onError={() => setImgFailed(true)}
            style={{
              width: "82%",
              height: "82%",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-display, Fraunces), serif",
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

  // Photo tile — alumni headshot with monogram fallback.
  const photoBg = tileBackground(tile.tone);
  const hasImage = !!tile.imgUrl && !imgFailed;
  return (
    <div
      className={baseClass}
      style={{
        borderRadius: radius,
        background: photoBg,
        containerType: "size",
        ...style,
      }}
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
            letterSpacing: ".01em",
          }}
        >
          {tile.initials}
        </span>
      )}
    </div>
  );
}
