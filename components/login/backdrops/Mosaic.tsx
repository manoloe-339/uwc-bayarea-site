"use client";

import { useEffect, useMemo, useState } from "react";
import Tile from "../Tile";
import type { LoginTile } from "../faces-shared";

interface Props {
  pool: LoginTile[];
}

const MAX_CELLS = 120;
const FLIP_INTERVAL_MS = 810;

/**
 * "Mosaic" backdrop — square-tile grid. Each cell holds a front and
 * a back tile, both drawn from the pool such that NO TWO CELLS share
 * a tile on either side. (Per user feedback: the user should never
 * see the same face or logo twice on the screen.) The flip crossfades
 * front → back without ever revealing the same image elsewhere.
 *
 * If the pool is smaller than 2 × MAX_CELLS we just render fewer
 * cells — the grid auto-fills available space anyway.
 */
export default function Mosaic({ pool }: Props) {
  const cells = useMemo(() => {
    if (pool.length === 0) return [] as Array<{ front: LoginTile; back: LoginTile }>;
    const out: Array<{ front: LoginTile; back: LoginTile }> = [];
    // Hard cap so front+back assignment never wraps. Each tile from
    // the pool is consumed at most once.
    const cellCount = Math.min(MAX_CELLS, Math.floor(pool.length / 2));
    for (let i = 0; i < cellCount; i++) {
      out.push({
        front: pool[i],
        back: pool[i + cellCount],
      });
    }
    return out;
  }, [pool]);

  const [flipped, setFlipped] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (let i = 0; i < MAX_CELLS; i++) if (i % 9 === 4) s.add(i);
    return s;
  });

  useEffect(() => {
    if (cells.length === 0) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const t = setInterval(() => {
      setFlipped((prev) => {
        const next = new Set(prev);
        for (let k = 0; k < 3; k++) {
          const idx = Math.floor(Math.random() * cells.length);
          if (next.has(idx)) next.delete(idx);
          else next.add(idx);
        }
        return next;
      });
    }, FLIP_INTERVAL_MS);
    return () => clearInterval(t);
  }, [cells.length]);

  if (cells.length === 0) return null;

  return (
    <>
      <div
        className="absolute -inset-2.5 z-0 grid gap-2 sm:gap-3 p-3 [--cell-min:54px] sm:[--cell-min:96px]"
        style={{
          gridTemplateColumns:
            "repeat(auto-fill, minmax(var(--cell-min), 1fr))",
          gridAutoRows: "1fr",
          gridAutoFlow: "dense",
        }}
      >
        {cells.map((cell, i) => {
          const isFlipped = flipped.has(i);
          return (
            <div
              key={i}
              className="relative"
              style={{ aspectRatio: "1" }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-[600ms] ease-out"
                style={{ opacity: isFlipped ? 0 : 1 }}
              >
                <Tile
                  tile={cell.front}
                  square
                  style={{ width: "100%", height: "100%" }}
                  noTitle
                />
              </div>
              <div
                className="absolute inset-0 transition-opacity duration-[600ms] ease-out"
                style={{ opacity: isFlipped ? 1 : 0 }}
              >
                <Tile
                  tile={cell.back}
                  square
                  style={{ width: "100%", height: "100%" }}
                  noTitle
                />
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "radial-gradient(46% 54% at 50% 50%, rgba(6,32,63,.94) 22%, rgba(6,32,63,.72) 46%, rgba(6,32,63,.34) 68%, rgba(6,32,63,.05) 100%)",
        }}
      />
    </>
  );
}
