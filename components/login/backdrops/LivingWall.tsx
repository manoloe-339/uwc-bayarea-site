"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Tile from "../Tile";
import type { LoginTile } from "../faces-shared";

interface Props {
  pool: LoginTile[];
}

const COLS = 7;
const PER_COL = 10;

/**
 * "Living Wall" — 7 vertical columns of perfectly round tiles
 * drifting at staggered speeds. Each column duplicates its tile set
 * so the translateY loop is seamless. Even columns scroll one
 * direction, odd the other.
 *
 * To enforce circle (not oval): the tile size is measured from the
 * actual rendered column width and used as BOTH width and height in
 * inline pixels. Pure CSS `aspect-ratio: 1` was unreliable inside
 * the flex column when paired with `container-type: size`, so we go
 * via JS measurement and a ResizeObserver.
 */
export default function LivingWall({ pool }: Props) {
  const wallRef = useRef<HTMLDivElement | null>(null);
  const [tilePx, setTilePx] = useState(96);

  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const measure = () => {
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
    <div className="absolute inset-0 overflow-hidden">
      <div
        ref={wallRef}
        className="absolute inset-0 -top-40 -bottom-40 flex gap-5 justify-center px-4"
      >
        {columns.map((col, ci) => {
          const dur = 38 + (ci % 4) * 9;
          return (
            <div
              key={ci}
              data-lw-col
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
