"use client";

import { useMemo } from "react";
import Tile from "../Tile";
import type { LoginTile } from "../faces-shared";

interface Props {
  /** Pool of tiles (already in 60/25/10/5 mix) to populate the wall. */
  pool: LoginTile[];
}

const COLS = 7;
const PER_COL = 10;

/**
 * "Living Wall" backdrop — 7 vertical columns of round tiles drifting
 * up/down at varied speeds. Pure-CSS animation (keyframes) — no JS
 * runtime cost beyond the initial render.
 *
 * Each column duplicates its tile set so the translateY loop appears
 * seamless. Even columns scroll one direction, odd the other.
 */
export default function LivingWall({ pool }: Props) {
  const columns = useMemo(() => {
    const out: LoginTile[][] = [];
    if (pool.length === 0) return out;
    for (let c = 0; c < COLS; c++) {
      const col: LoginTile[] = [];
      const start = (c * 5) % pool.length;
      for (let i = 0; i < PER_COL; i++) col.push(pool[(start + i) % pool.length]);
      out.push(col);
    }
    return out;
  }, [pool]);

  if (columns.length === 0) return null;

  return (
    <div className="lw-frame absolute inset-0 overflow-hidden">
      <div className="lw-wall absolute inset-0 -top-40 -bottom-40 flex gap-5 justify-center px-4">
        {columns.map((col, ci) => {
          const dur = 38 + (ci % 4) * 9;
          return (
            <div
              key={ci}
              className="flex flex-col gap-5"
              style={{
                width: "clamp(78px, 8vw, 116px)",
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
                  className="w-full"
                  style={{
                    aspectRatio: "1",
                    boxShadow: "0 0 0 4px #fff, 0 10px 22px -10px rgba(11,37,69,.5)",
                    opacity: 0.85 + ((i * 7) % 15) / 100,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      {/* Left → dark scrim, fading toward form side */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, var(--rich-deep) 1%, rgba(6,32,63,.4) 16%, rgba(6,32,63,0) 34%)",
        }}
      />
      {/* Top/bottom vertical fade so columns blend into the navy */}
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
          .lw-wall > div { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
