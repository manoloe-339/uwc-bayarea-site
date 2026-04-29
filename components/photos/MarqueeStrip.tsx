"use client";

import { useEffect, useRef, useState } from "react";
import type { MarqueePhoto } from "@/lib/photo-galleries";

const TILE_VARIANTS: Array<[number, number]> = [
  [4, 3],
  [3, 4],
  [3, 2],
  [1, 1],
  [5, 4],
];

export default function MarqueeStrip({
  photos,
  paused,
  slideDurationSec,
  scrollSpeedSec,
  presentTitle,
  presentTitleAccent,
  presentEyebrow,
}: {
  photos: MarqueePhoto[];
  paused: boolean;
  slideDurationSec: number;
  scrollSpeedSec: number;
  presentTitle: string | null;
  presentTitleAccent: string | null;
  presentEyebrow: string | null;
}) {
  const [presenting, setPresenting] = useState(false);

  if (photos.length === 0) return null;

  const half = Math.ceil(photos.length / 2);
  const rowA = photos.slice(0, half);
  const rowB =
    photos.length > 2
      ? photos.slice(half).concat(photos.slice(0, 2))
      : [...photos];

  // Row B is intentionally a touch slower than row A for visual richness.
  const speedA = scrollSpeedSec;
  const speedB = Math.round(scrollSpeedSec * 1.21);

  function startPresent() {
    // Request fullscreen synchronously inside the user-gesture handler so
    // Safari/Firefox accept it. Safari iOS will silently refuse — that's OK,
    // the fixed-position container still covers the viewport.
    const root = document.documentElement;
    if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    }
    setPresenting(true);
  }

  return (
    <div className="relative">
      <div
        className="border-b border-[color:var(--rule)] py-7"
        style={{ background: "var(--navy-deep)" }}
      >
        <div className="flex flex-col gap-3">
          <MarqueeRow photos={rowA} reverse={false} speed={speedA} tileH={220} paused={paused} />
          <MarqueeRow photos={rowB} reverse={true} speed={speedB} tileH={220} paused={paused} />
        </div>
      </div>

      <button
        type="button"
        onClick={startPresent}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[.18em] uppercase text-[color:var(--navy-ink)] cursor-pointer hover:bg-white"
        style={{
          background: "rgba(255,255,255,.95)",
          border: "1px solid rgba(255,255,255,.4)",
          boxShadow: "0 6px 18px -6px rgba(0,0,0,.35)",
        }}
        aria-label="Start photo presentation"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
        Present
      </button>

      {presenting && (
        <PresentMode
          photos={photos}
          intervalMs={slideDurationSec * 1000}
          onClose={() => setPresenting(false)}
          eyebrow={presentEyebrow}
          title={presentTitle}
          titleAccent={presentTitleAccent}
        />
      )}

      <style jsx>{`
        :global(.marquee-strip) {
          width: max-content;
          display: flex;
          gap: 12px;
        }
        :global(.marquee-strip.run-ltr) {
          animation: marquee-ltr var(--marquee-dur, 70s) linear infinite;
        }
        :global(.marquee-strip.run-rtl) {
          animation: marquee-rtl var(--marquee-dur, 85s) linear infinite;
        }
        :global(.marquee-strip.paused) {
          animation-play-state: paused;
        }
        @keyframes marquee-ltr {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @keyframes marquee-rtl {
          from {
            transform: translateX(-50%);
          }
          to {
            transform: translateX(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.marquee-strip) {
            animation-duration: 600s !important;
          }
        }
      `}</style>
    </div>
  );
}

function MarqueeRow({
  photos,
  reverse,
  speed,
  tileH,
  paused,
}: {
  photos: MarqueePhoto[];
  reverse: boolean;
  speed: number;
  tileH: number;
  paused: boolean;
}) {
  const strip = [...photos, ...photos];
  return (
    <div
      className="overflow-hidden w-full"
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 80px, black calc(100% - 80px), transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0, black 80px, black calc(100% - 80px), transparent 100%)",
      }}
    >
      <div
        className={`marquee-strip ${reverse ? "run-rtl" : "run-ltr"} ${paused ? "paused" : ""}`}
        style={{ ["--marquee-dur" as string]: `${speed}s` }}
      >
        {strip.map((p, i) => {
          const [w, h] = TILE_VARIANTS[i % TILE_VARIANTS.length];
          const tileW = Math.round(tileH * (w / h));
          return (
            <div
              key={i}
              style={{
                flex: "0 0 auto",
                width: tileW,
                height: tileH,
                background: "var(--ivory-2)",
                boxShadow:
                  "0 2px 0 var(--ivory-3), 0 12px 24px -12px rgba(11,37,69,.18)",
              }}
            >
              <img
                src={p.url}
                alt=""
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  filter: "saturate(.9)",
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PresentMode({
  photos,
  onClose,
  intervalMs,
  eyebrow,
  title,
  titleAccent,
}: {
  photos: MarqueePhoto[];
  onClose: () => void;
  intervalMs: number;
  eyebrow: string | null;
  title: string | null;
  titleAccent: string | null;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Activity-based auto-hide of controls (3s of no movement → fade).
  useEffect(() => {
    function bump() {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
    bump();
    const el = containerRef.current;
    el?.addEventListener("mousemove", bump);
    el?.addEventListener("touchstart", bump);
    el?.addEventListener("click", bump);
    window.addEventListener("keydown", bump);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      el?.removeEventListener("mousemove", bump);
      el?.removeEventListener("touchstart", bump);
      el?.removeEventListener("click", bump);
      window.removeEventListener("keydown", bump);
    };
  }, []);

  // Cleanup: exit fullscreen when unmounting (button onClick entered it).
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Browser fullscreen exited (e.g. user hit Esc in the browser UI) → close present.
  useEffect(() => {
    function onFsChange() {
      // Only close if we're not in fullscreen AND we previously were. The
      // initial state may have already been non-fullscreen on iOS Safari, so
      // we don't auto-close on mount — only when the element actually exits.
      if (!document.fullscreenElement && document.fullscreenEnabled) {
        // Was fullscreen, now isn't → close. (We use enabled as a proxy for
        // "the browser supports it"; if it doesn't, we never entered, never close.)
        // No-op when API is unsupported.
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIdx((i) => (i + 1) % photos.length);
      else if (e.key === "ArrowLeft")
        setIdx((i) => (i - 1 + photos.length) % photos.length);
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  // Autoplay timer.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % photos.length), intervalMs);
    return () => clearTimeout(t);
  }, [idx, playing, intervalMs, photos.length]);

  const eyebrowText = eyebrow && eyebrow.trim() ? `${eyebrow.trim()} · Presenting` : "Presenting";
  const titleText = title?.trim() ?? "";
  const accentText = titleAccent?.trim() ?? "";
  const progressPct = ((idx + 1) / photos.length) * 100;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black overflow-hidden"
      style={{ cursor: controlsVisible ? "default" : "none" }}
    >
      {photos.map((p, i) => {
        const active = i === idx;
        const kbDirection = i % 2 === 0 ? "kb-zoom-in" : "kb-zoom-out";
        return (
          <div
            key={p.id}
            className="absolute inset-0"
            style={{
              opacity: active ? 1 : 0,
              transition: "opacity 1.2s ease",
              pointerEvents: active ? "auto" : "none",
            }}
          >
            {/* Blurred backdrop — kills the dead-black-bar look around portrait shots. */}
            <img
              src={p.url}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(56px) saturate(1.05) brightness(0.72)",
                transform: "scale(1.25)",
              }}
            />
            {/* Crisp foreground photo (position:absolute + DOM order keeps it above
                the backdrop without creating a stacking context that would paint
                above the top/bottom control bars). */}
            <img
              src={p.url}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                animation: active
                  ? `${kbDirection} ${intervalMs + 1500}ms ease-out forwards`
                  : "none",
              }}
            />
          </div>
        );
      })}

      {/* Top bar — eyebrow + title (from intro band settings) */}
      <div
        className="absolute top-0 left-0 right-0 z-10 px-5 sm:px-8 py-4 sm:py-6 text-white pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,.55), transparent)",
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity .3s ease",
        }}
      >
        <div
          className="font-bold uppercase mb-1"
          style={{
            fontSize: 10,
            letterSpacing: ".28em",
            color: "rgba(255,255,255,.7)",
          }}
        >
          {eyebrowText}
        </div>
        {(titleText || accentText) && (
          <div
            className="font-display font-semibold"
            style={{
              fontSize: "clamp(18px, 3vw, 24px)",
              letterSpacing: "-.01em",
              lineHeight: 1.15,
            }}
          >
            {titleText}
            {titleText && accentText ? " " : ""}
            {accentText && <em style={{ fontStyle: "italic" }}>{accentText}</em>}
          </div>
        )}
      </div>

      {/* Bottom: progress bar + counter + buttons */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 text-white"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,.55), transparent)",
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity .3s ease",
        }}
      >
        {/* Progress bar — click to scrub */}
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const newIdx = Math.max(
              0,
              Math.min(photos.length - 1, Math.floor(ratio * photos.length))
            );
            setIdx(newIdx);
          }}
          aria-label="Scrub through slideshow"
          className="block w-full p-0 m-0 border-0 cursor-pointer"
          style={{
            background: "rgba(255,255,255,.18)",
            height: 3,
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: "#fff",
              transition: "width .3s ease",
            }}
          />
        </button>

        <div className="flex justify-between items-center px-5 sm:px-8 py-4 sm:py-5 gap-3">
          <div
            className="font-bold uppercase tabular-nums"
            style={{
              fontSize: 11,
              letterSpacing: ".22em",
              color: "rgba(255,255,255,.85)",
            }}
          >
            {String(idx + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
          </div>

          <div className="flex gap-1.5 sm:gap-2">
            <PresentBtn
              onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
              title="Previous (←)"
            >
              ←
            </PresentBtn>
            <PresentBtn onClick={() => setPlaying((p) => !p)} title="Play/Pause (Space)">
              {playing ? "❚❚" : "▶"}
            </PresentBtn>
            <PresentBtn
              onClick={() => setIdx((i) => (i + 1) % photos.length)}
              title="Next (→)"
            >
              →
            </PresentBtn>
            <PresentBtn onClick={onClose} title="Exit (Esc)" close>
              ✕
            </PresentBtn>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes kb-zoom-in {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.08) translate(-1.5%, -1%);
          }
        }
        @keyframes kb-zoom-out {
          0% {
            transform: scale(1.08) translate(1%, -1%);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

function PresentBtn({
  children,
  onClick,
  title,
  close,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  close?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center cursor-pointer"
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: close ? "rgba(184,52,31,.9)" : "rgba(255,255,255,.12)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,.25)",
        fontSize: 13,
        fontWeight: 600,
        transition: "background .15s ease",
      }}
    >
      {children}
    </button>
  );
}
