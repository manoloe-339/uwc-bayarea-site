"use client";

import { useEffect, useMemo, useState } from "react";
import Tile from "../Tile";
import type { LoginTile } from "../faces-shared";

interface Props {
  pool: LoginTile[];
}

const CELL_COUNT = 120;
const FLIP_INTERVAL_MS = 900;

/**
 * "Mosaic" backdrop — square-tile grid. Each cell holds a front and
 * a back tile (two different images from the pool). The flip
 * crossfades between them. No name reveal — per user feedback the
 * first-name back-side looked bad and added no information, so we
 * cycle image-to-image instead.
 */
export default function Mosaic({ pool }: Props) {
  // Each cell gets a stable PAIR of tiles: front + back. Different
  // offsets through the pool so the front and back are unrelated.
  const cells = useMemo(() => {
    if (pool.length === 0) return [] as Array<{ front: LoginTile; back: LoginTile }>;
    const out: Array<{ front: LoginTile; back: LoginTile }> = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      out.push({
        front: pool[(i * 7) % pool.length],
        // +37 is coprime with most pool sizes — ensures front and
        // back lift different tiles even when the pool is small.
        back: pool[(i * 7 + 37) % pool.length],
      });
    }
    return out;
  }, [pool]);

  const [flipped, setFlipped] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (let i = 0; i < CELL_COUNT; i++) if (i % 9 === 4) s.add(i);
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
          const idx = Math.floor(Math.random() * CELL_COUNT);
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
        className="absolute -inset-2.5 z-0 grid gap-3 p-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
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
