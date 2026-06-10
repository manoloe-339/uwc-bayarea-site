"use client";

import { useEffect, useRef, useState } from "react";
import LivingWall from "./backdrops/LivingWall";
import Mosaic from "./backdrops/Mosaic";
import Constellation from "./backdrops/Constellation";
import type { LoginTile } from "./faces-shared";

export type BackdropId = "living" | "mosaic" | "constellation";

interface Props {
  /** 60/25/10/5 mixed pool for Mosaic + Constellation. Deduplicated:
   * no two tiles share an id. */
  mixedPool: LoginTile[];
  /** Photos only — for Living Wall. */
  photoPool: LoginTile[];
  /** Server-chosen starting backdrop, so SSR + first client render
   * agree and the user doesn't see a one-frame flash from the default
   * before the random pick lands. */
  initial: BackdropId;
  /** Fired whenever the active backdrop changes (including the
   * initial mount). Used by the parent to drive the Log-in pill's
   * countdown ring so the ring and the rotation share one timer. */
  onCycleStart?: (id: BackdropId) => void;
}

const ORDER: BackdropId[] = ["living", "mosaic", "constellation"];
const ROTATE_MS = 10_000;
const FADE_MS = 700;

/**
 * Rotates the three login backdrops on a 10s fixed-order cycle
 * (A → B → C → A), with a ~700ms crossfade between them. Initial
 * pick is random. If the user has `prefers-reduced-motion: reduce`
 * the rotation stops — we pick one and stay.
 *
 * The rich-blue gradient lives on this wrapper so the swap is purely
 * an opacity transition on the backdrop layers above it; the user
 * never sees a flash of unstyled background.
 */
export default function LoginBackdrop({
  mixedPool,
  photoPool,
  initial,
  onCycleStart,
}: Props) {
  const [current, setCurrent] = useState<BackdropId>(initial);
  const [previous, setPrevious] = useState<BackdropId | null>(null);
  const previousTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image preloading is handled by <LoadingGate> in the page shell —
  // it holds the rotator behind a progress bar until enough images
  // are settled in the browser cache, then reveals everything at
  // once. Nothing to preload here.

  // Fire onCycleStart for the initial backdrop too, so the pill's
  // ring countdown starts from the moment the page is interactive.
  useEffect(() => {
    onCycleStart?.(initial);
    // We only fire on mount; subsequent rotations fire from the
    // interval effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle setup. Skipped under reduce-motion — the user simply gets
  // whichever backdrop was chosen on the server.
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const t = setInterval(() => {
      setCurrent((c) => {
        const i = ORDER.indexOf(c);
        const next = ORDER[(i + 1) % ORDER.length];
        // Keep the outgoing backdrop mounted briefly so we can
        // crossfade its opacity to 0 over FADE_MS.
        setPrevious(c);
        if (previousTimeout.current) clearTimeout(previousTimeout.current);
        previousTimeout.current = setTimeout(() => setPrevious(null), FADE_MS);
        onCycleStart?.(next);
        return next;
      });
    }, ROTATE_MS);
    return () => {
      clearInterval(t);
      if (previousTimeout.current) clearTimeout(previousTimeout.current);
    };
    // onCycleStart is intentionally not a dep — it's a "fire and
    // forget" hook for the parent and we don't want timer churn if
    // the parent's identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden"
      style={{ background: "var(--rich-blue)" }}
    >
      {ORDER.map((id) => {
        const isCurrent = id === current;
        const isPrevious = id === previous;
        if (!isCurrent && !isPrevious) return null;
        return (
          <div
            key={id}
            className="absolute inset-0 transition-opacity ease-out"
            style={{
              opacity: isCurrent ? 1 : 0,
              transitionDuration: `${FADE_MS}ms`,
            }}
          >
            <BackdropFor id={id} mixedPool={mixedPool} photoPool={photoPool} />
          </div>
        );
      })}
    </div>
  );
}

function BackdropFor({
  id,
  mixedPool,
  photoPool,
}: {
  id: BackdropId;
  mixedPool: LoginTile[];
  photoPool: LoginTile[];
}) {
  if (id === "living") return <LivingWall pool={photoPool} />;
  if (id === "mosaic") return <Mosaic pool={mixedPool} />;
  // Constellation is photos-only too — logo tiles inside rotating
  // circular nodes look wrong (the logo's own rectangular backplate
  // shows as a "square inside a circle", and the rotation tilts
  // wordmarks awkwardly).
  return <Constellation pool={photoPool} />;
}
