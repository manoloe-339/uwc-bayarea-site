"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Tile from "../Tile";
import type { LoginTile } from "../faces-shared";

interface Props {
  pool: LoginTile[];
}

const CELL_COUNT = 120;
const FLIP_INTERVAL_MS = 900;

/**
 * "Mosaic" backdrop — a tight grid of square tiles. Random cells
 * crossfade between the front (face / logo / flag) and the back
 * (the tile's label on a deep-blue square). 3 cells flip every
 * 900ms. A radial-blue veil dims the center for sign-in legibility.
 */
export default function Mosaic({ pool }: Props) {
  const cells = useMemo(() => {
    if (pool.length === 0) return [] as LoginTile[];
    const out: LoginTile[] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      out.push(pool[(i * 7) % pool.length]);
    }
    return out;
  }, [pool]);

  // Random initial flipped-state — a few logos / names at rest.
  const [flipped, setFlipped] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (let i = 0; i < CELL_COUNT; i++) if (i % 9 === 4) s.add(i);
    return s;
  });
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;

  // Per-cell sized name labels — measured once after mount.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [nameFontPx, setNameFontPx] = useState(14);
  useEffect(() => {
    const measure = () => {
      const g = gridRef.current;
      if (!g) return;
      const cell = g.querySelector("[data-mz-cell]") as HTMLElement | null;
      if (!cell) return;
      const w = cell.clientWidth || 96;
      setNameFontPx(Math.max(11, Math.min(w * 0.42, w * 0.22)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, [cells.length]);

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
        ref={gridRef}
        className="absolute -inset-2.5 z-0 grid gap-3 p-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
          gridAutoRows: "1fr",
          gridAutoFlow: "dense",
        }}
      >
        {cells.map((tile, i) => {
          const isFlipped = flipped.has(i);
          return (
            <div
              key={i}
              data-mz-cell
              className="relative"
              style={{ aspectRatio: "1" }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-[600ms] ease-out"
                style={{ opacity: isFlipped ? 0 : 1 }}
              >
                <Tile tile={tile} square className="w-full h-full" noTitle />
              </div>
              <div
                className="absolute inset-0 transition-opacity duration-[600ms] ease-out"
                style={{ opacity: isFlipped ? 1 : 0 }}
              >
                <NameTile label={tile.label} fontSize={nameFontPx} />
              </div>
            </div>
          );
        })}
      </div>
      {/* Radial deep-blue veil keeps the center card legible */}
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

function NameTile({ label, fontSize }: { label: string; fontSize: number }) {
  return (
    <div
      className="w-full h-full flex items-center justify-center text-center overflow-hidden"
      style={{
        borderRadius: "18%",
        padding: "9%",
        background: "linear-gradient(155deg, #0d5099, #06223f)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display, Fraunces), serif",
          fontWeight: 700,
          color: "#fff",
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          letterSpacing: "-.015em",
          whiteSpace: "nowrap",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  );
}
