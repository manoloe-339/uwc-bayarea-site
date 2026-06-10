"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Tile from "../Tile";
import type { LoginTile } from "../faces-shared";

interface Props {
  pool: LoginTile[];
}

const TARGET_COL_WIDTH = 110;
const COL_GAP = 20;
const PER_COL = 12;

/**
 * "Living Wall" — vertical columns of perfectly round profile-photo
 * tiles drifting at staggered speeds. Photos-only by spec (no UWC /
 * org / flag tiles); the column count is computed from the viewport
 * width so the wall covers the full page edge-to-edge instead of
 * clustering in the center. Each column duplicates its tile set so
 * the translateY loop is seamless. Even columns scroll one direction,
 * odd the other.
 *
 * To enforce circle (not oval) the tile size is measured from the
 * actual column width and used as both width AND height in pixels
 * (CSS aspect-ratio inside a flex column wasn't reliable). We also
 * align-items: start the parent so the column doesn't get stretched
 * vertically and squash the tile children into ellipses.
 *
 * Tiles assigned across columns come from a single shuffle so the
 * same photo never appears in two columns simultaneously.
 */
export default function LivingWall({ pool }: Props) {
  const wallRef = useRef<HTMLDivElement | null>(null);
  const [tilePx, setTilePx] = useState(96);
  const [colCount, setColCount] = useState(7);

  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const measure = () => {
      const w = wall.clientWidth;
      // Fit as many ~TARGET_COL_WIDTH columns as the wall allows,
      // accounting for the gaps between them.
      const cols = Math.max(
        5,
        Math.floor((w + COL_GAP) / (TARGET_COL_WIDTH + COL_GAP)),
      );
      setColCount(cols);
      const col = wall.querySelector("[data-lw-col]") as HTMLElement | null;
      if (col) setTilePx(col.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wall);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => {
    const out: LoginTile[][] = [];
    if (pool.length === 0) return out;
    // Distribute the pool across columns so a single photo only
    // shows up once across the entire wall. Each column gets a
    // CONTIGUOUS slice of the pool (PER_COL tiles, wrapping at the
    // pool's end if we don't have enough unique photos — in
    // practice the pool is sized for 200+ which always covers
    // colCount * PER_COL).
    for (let c = 0; c < colCount; c++) {
      const col: LoginTile[] = [];
      const start = (c * PER_COL) % pool.length;
      for (let i = 0; i < PER_COL; i++) {
        col.push(pool[(start + i) % pool.length]);
      }
      out.push(col);
    }
    return out;
  }, [pool, colCount]);

  if (columns.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        ref={wallRef}
        className="absolute inset-0 -top-40 -bottom-40 flex items-start"
        style={{
          gap: `${COL_GAP}px`,
          justifyContent: "space-between",
          paddingLeft: `${COL_GAP / 2}px`,
          paddingRight: `${COL_GAP / 2}px`,
        }}
      >
        {columns.map((col, ci) => {
          const dur = 38 + (ci % 4) * 9;
          return (
            <div
              key={ci}
              data-lw-col
              className="flex flex-col"
              style={{
                width: `${TARGET_COL_WIDTH}px`,
                gap: `${COL_GAP}px`,
                animationName: "lw-scroll",
                animationDuration: `${dur}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDirection: ci % 2 ? "reverse" : "normal",
              }}
            >
              {[...col, ...col].map((tile, i) => (
                <Tile
                  key={`${ci}-${i}`}
                  tile={tile}
                  style={{
                    width: `${tilePx}px`,
                    height: `${tilePx}px`,
                    boxShadow:
                      "0 0 0 4px #fff, 0 10px 22px -10px rgba(11,37,69,.5)",
                    opacity: 0.85 + ((i * 7) % 15) / 100,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, var(--rich-deep) 1%, rgba(6,32,63,.4) 16%, rgba(6,32,63,0) 34%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, var(--rich-deep) 0%, rgba(6,32,63,0) 16% 84%, var(--rich-deep) 100%)",
        }}
      />
      <style jsx>{`
        @keyframes lw-scroll {
          from { transform: translateY(0); }
          to   { transform: translateY(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-lw-col] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
