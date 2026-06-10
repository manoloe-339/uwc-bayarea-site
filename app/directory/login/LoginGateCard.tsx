"use client";

import { useEffect, useState } from "react";
import DirectoryLoginForm from "./DirectoryLoginForm";

interface Props {
  next: string;
}

/** Default reload interval while the user is idly watching the
 * backdrops cycle. Aligns with one full rotation through Living
 * Wall → Mosaic → Constellation (3 × 10s = 30s). Each reload pulls
 * a fresh photo subset + new tile positions so a viewer sees a
 * different layout every cycle. */
const IDLE_RELOAD_MS = 30_000;

/**
 * Two-state sign-in surface:
 *
 *   Idle  — a polished, breathing "Log in" pill centered over the
 *           backdrop. An auto-reload timer fires every 30 s so a
 *           watching viewer sees a fresh layout each cycle.
 *   Form  — the user clicked Log in; full sign-in card crossfades
 *           into place. The reload timer stops so we don't interrupt
 *           typing.
 *
 * Both states share the same wrapper element so React preserves
 * position during the crossfade — the form expands out of the
 * pill's centerpoint rather than popping in from elsewhere.
 */
export default function LoginGateCard({ next }: Props) {
  const [showForm, setShowForm] = useState(false);
  // Slight delay before the pill becomes interactable, so the
  // entrance animation gets a chance to play unmolested.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (showForm) return;
    const t = setTimeout(() => {
      window.location.reload();
    }, IDLE_RELOAD_MS);
    return () => clearTimeout(t);
  }, [showForm]);

  return (
    <>
      {/* Idle pill */}
      <button
        type="button"
        onClick={() => setShowForm(true)}
        aria-label="Open sign-in form"
        tabIndex={showForm ? -1 : 0}
        className="lg-pill"
        data-entered={entered ? "1" : "0"}
        data-hidden={showForm ? "1" : "0"}
      >
        <span aria-hidden className="lg-pill__dot" />
        <span className="lg-pill__label">Log in</span>
        <svg
          aria-hidden
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lg-pill__arrow"
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </button>

      {/* Form card — mounted in DOM the whole time so the crossfade
          works cleanly, but pointer-events disabled while hidden. */}
      <div
        className="lg-card"
        data-visible={showForm ? "1" : "0"}
        aria-hidden={!showForm}
      >
        <div
          className="w-full max-w-[320px] rounded-[12px] p-5 sm:p-6"
          style={{
            background: "rgba(255,255,255,.97)",
            border: "1px solid rgba(11,37,69,.08)",
            boxShadow:
              "0 2px 0 var(--ivory-3), 0 30px 60px -30px rgba(11,37,69,.5)",
          }}
        >
          <div className="flex items-center gap-2 text-navy font-bold text-[10px] tracking-[.22em] uppercase">
            <span className="inline-block w-5 h-0.5 bg-navy" aria-hidden />
            Directory access
          </div>
          <h1
            className="text-[color:var(--navy-ink)] mt-2 font-extrabold leading-[1.04]"
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "clamp(22px, 5vw, 28px)",
              letterSpacing: "-.025em",
            }}
          >
            Sign in
          </h1>
          <div className="mt-3">
            <DirectoryLoginForm next={next} />
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ---------------- Pill ---------------- */
        .lg-pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 26px 16px 22px;
          border-radius: 999px;
          font-family: Inter, system-ui, sans-serif;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--navy-ink);
          background: rgba(255, 255, 255, 0.97);
          border: 1px solid rgba(11, 37, 69, 0.08);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            0 2px 0 var(--ivory-3),
            0 12px 30px -10px rgba(11, 37, 69, 0.55);
          cursor: pointer;
          /* Entrance: invisible + pushed down. data-entered=1 lifts it. */
          opacity: 0;
          transform: translateY(14px) scale(0.96);
          transition:
            opacity 520ms cubic-bezier(0.2, 0.7, 0.2, 1),
            transform 520ms cubic-bezier(0.2, 0.7, 0.2, 1),
            box-shadow 240ms ease;
          will-change: transform, opacity;
        }
        .lg-pill[data-entered="1"] {
          opacity: 1;
          transform: translateY(0) scale(1);
          /* Then start the gentle breathing once entered. */
          animation: lg-breathe 4.2s ease-in-out 600ms infinite;
        }
        .lg-pill[data-hidden="1"] {
          opacity: 0;
          transform: translateY(-6px) scale(0.96);
          pointer-events: none;
          animation: none;
        }
        .lg-pill:hover {
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.7),
            0 3px 0 var(--ivory-3),
            0 22px 40px -14px rgba(11, 37, 69, 0.65);
          transform: translateY(-2px) scale(1.02);
          animation-play-state: paused;
        }
        .lg-pill:active {
          transform: translateY(0) scale(0.99);
        }
        .lg-pill:focus-visible {
          outline: 2px solid var(--navy);
          outline-offset: 3px;
        }
        .lg-pill__dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--navy);
          box-shadow: 0 0 0 4px rgba(2, 101, 168, 0.14);
        }
        .lg-pill__label {
          line-height: 1;
        }
        .lg-pill__arrow {
          color: var(--navy);
          transition: transform 240ms cubic-bezier(0.2, 0.7, 0.2, 1);
        }
        .lg-pill:hover .lg-pill__arrow {
          transform: translateX(3px);
        }

        /* ---------------- Breathing keyframe ---------------- */
        @keyframes lg-breathe {
          0%,
          100% {
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.6),
              0 2px 0 var(--ivory-3),
              0 12px 30px -10px rgba(11, 37, 69, 0.55);
          }
          50% {
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.7),
              0 2px 0 var(--ivory-3),
              0 18px 36px -12px rgba(11, 37, 69, 0.7);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-pill[data-entered="1"] {
            animation: none;
          }
        }

        /* Mobile: pill ~10% smaller. */
        @media (max-width: 640px) {
          .lg-pill {
            padding: 14px 23px 14px 20px;
            font-size: 12.5px;
            gap: 10px;
          }
          .lg-pill__dot {
            width: 6px;
            height: 6px;
          }
        }

        /* ---------------- Form card ---------------- */
        .lg-card {
          position: absolute;
          inset: auto auto auto auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          opacity: 0;
          transform: translateY(10px) scale(0.97);
          transition:
            opacity 360ms cubic-bezier(0.2, 0.7, 0.2, 1),
            transform 420ms cubic-bezier(0.2, 0.7, 0.2, 1);
          pointer-events: none;
        }
        .lg-card[data-visible="1"] {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }
      `}</style>
    </>
  );
}
