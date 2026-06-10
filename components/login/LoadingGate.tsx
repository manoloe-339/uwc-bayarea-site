"use client";

import { useEffect, useState } from "react";

interface Props {
  /** Image URLs to preload + count toward the progress bar. */
  urls: string[];
  /** Fraction (0..1) of URLs that must finish (loaded OR errored)
   * before the gate fades open. Default 0.5 — half of the pool is a
   * reasonable threshold to avoid a "loading tiles" pop-in. */
  threshold?: number;
  children: React.ReactNode;
}

/**
 * Holds back the backdrop + sign-in card until enough images have
 * finished loading. Renders a thin progress bar centered on the
 * rich-blue gradient until threshold% of the URLs settle, then
 * crossfades open in ~500ms. Children mount immediately behind the
 * gate so their <img> network requests deduplicate with the gate's
 * own preload requests — same URL, same browser cache entry.
 */
export default function LoadingGate({
  urls,
  threshold = 0.5,
  children,
}: Props) {
  const targetCount = Math.max(1, Math.ceil(urls.length * threshold));
  const [settled, setSettled] = useState(0);
  const [fading, setFading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Kick off all preload fetches once on mount. We use new Image()
  // not <link rel="preload"> because we need an onload event we can
  // count toward the progress bar.
  useEffect(() => {
    if (urls.length === 0) {
      setRevealed(true);
      return;
    }
    let active = true;
    let n = 0;
    const onDone = () => {
      if (!active) return;
      n++;
      setSettled(n);
    };
    for (const u of urls) {
      const img = new window.Image();
      img.onload = onDone;
      img.onerror = onDone; // a failure still counts — we're not blocking on it
      img.src = u;
    }
    return () => {
      active = false;
    };
  }, [urls]);

  // Once we've hit the threshold, hold 100% on the bar for a beat,
  // then start the fade. revealed=true unmounts the overlay.
  useEffect(() => {
    if (revealed) return;
    if (settled >= targetCount) {
      const t1 = setTimeout(() => setFading(true), 200);
      const t2 = setTimeout(() => setRevealed(true), 700);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [settled, targetCount, revealed]);

  const pct = Math.min(100, (settled / targetCount) * 100);

  return (
    <>
      {children}
      {!revealed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity ease-out"
          style={{
            background: "var(--rich-blue)",
            opacity: fading ? 0 : 1,
            transitionDuration: "500ms",
            pointerEvents: fading ? "none" : "auto",
          }}
          aria-hidden={fading}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="Loading directory"
        >
          <div className="w-56 h-[3px] rounded-full overflow-hidden bg-white/15">
            <div
              className="h-full bg-white"
              style={{
                width: `${pct}%`,
                transition: "width 220ms ease-out",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
