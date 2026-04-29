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
}: {
  photos: MarqueePhoto[];
  paused: boolean;
  slideDurationSec: number;
  scrollSpeedSec: number;
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
        onClick={() => setPresenting(true)}
        className="absolute top-5 right-5 z-10 inline-flex items-center gap-2.5 rounded-full px-5 py-3 text-[11px] font-bold tracking-[.22em] uppercase text-[color:var(--navy-ink)] cursor-pointer hover:bg-white"
        style={{
          background: "rgba(255,255,255,.95)",
          border: "1px solid rgba(255,255,255,.4)",
          boxShadow: "0 12px 30px -10px rgba(0,0,0,.4)",
        }}
        aria-label="Start photo presentation"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
        Present
      </button>

      {presenting && (
        <PresentMode
          photos={photos}
          intervalMs={slideDurationSec * 1000}
          onClose={() => setPresenting(false)}
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
}: {
  photos: MarqueePhoto[];
  onClose: () => void;
  intervalMs: number;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

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

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % photos.length), intervalMs);
    return () => clearTimeout(t);
  }, [idx, playing, intervalMs, photos.length]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
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
            <img
              src={p.url}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                background: "#000",
                animation: active
                  ? `${kbDirection} ${intervalMs + 1500}ms ease-out forwards`
                  : "none",
              }}
            />
          </div>
        );
      })}

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 px-8 py-6 flex justify-between items-center text-white pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.55), transparent)" }}
      >
        <div>
          <div
            className="font-bold uppercase mb-1"
            style={{
              fontSize: 10.5,
              letterSpacing: ".28em",
              color: "rgba(255,255,255,.7)",
            }}
          >
            UWC Bay Area &middot; Presenting
          </div>
          <div
            className="font-display font-semibold"
            style={{ fontSize: 22, letterSpacing: "-.01em" }}
          >
            A community, <em style={{ fontStyle: "italic" }}>in pictures</em>
          </div>
        </div>
        <div
          className="font-bold uppercase"
          style={{
            fontSize: 12,
            letterSpacing: ".22em",
            color: "rgba(255,255,255,.85)",
          }}
        >
          {String(idx + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className="absolute bottom-0 left-0 right-0 px-8 py-6 flex justify-between items-center gap-4"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,.55), transparent)" }}
      >
        <div className="flex gap-1.5 flex-wrap" style={{ maxWidth: "60%" }}>
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Go to photo ${i + 1}`}
              className="border-0 cursor-pointer p-0"
              style={{
                width: i === idx ? 24 : 6,
                height: 6,
                borderRadius: 3,
                background: i === idx ? "#fff" : "rgba(255,255,255,.45)",
                transition: "width .3s ease, background .2s ease",
              }}
            />
          ))}
        </div>

        <div className="flex gap-2">
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
        width: 44,
        height: 44,
        borderRadius: 999,
        background: close ? "rgba(184,52,31,.9)" : "rgba(255,255,255,.12)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,.25)",
        fontSize: 14,
        fontWeight: 600,
        transition: "background .15s ease",
      }}
    >
      {children}
    </button>
  );
}
