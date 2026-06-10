"use client";

import { useEffect, useState } from "react";
import DirectoryLoginForm from "./DirectoryLoginForm";

interface Props {
  next: string;
  /** Lifted state — LoginExperience owns the showForm flag because
   * it also drives whether to poll for fresh pool data. */
  showForm: boolean;
  onShowFormChange: (next: boolean) => void;
  /** Timestamp the current backdrop started (Date.now()-style). The
   * SVG ring's animation is keyed to this so it restarts cleanly
   * each cycle, in perfect sync with the rotation. */
  cycleStartedAt: number;
  /** Cycle length in ms — controls the ring fill duration. */
  cycleMs: number;
}

/**
 * Two-state sign-in surface:
 *
 *   Idle  — a polished, breathing "Log in" pill centered over the
 *           backdrop. While idle, the parent (LoginExperience) is
 *           polling for fresh pool data every 30 s and swapping it
 *           into the running backdrops, so the viewer sees a fresh
 *           layout each cycle WITHOUT a page reload.
 *   Form  — the user clicked Log in; full sign-in card crossfades
 *           into place. The parent stops polling so we don't yank
 *           tiles around while they're typing.
 *
 * Both states are mounted in the DOM so the crossfade is clean —
 * the form expands out of the pill's centerpoint rather than
 * popping in from elsewhere.
 */
export default function LoginGateCard({
  next,
  showForm,
  onShowFormChange,
  cycleStartedAt,
  cycleMs,
}: Props) {
  // Slight delay before the pill becomes interactable, so the
  // entrance animation gets a chance to play unmolested.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Idle pill */}
      <button
        type="button"
        onClick={() => onShowFormChange(true)}
        aria-label="Open sign-in form"
        tabIndex={showForm ? -1 : 0}
        className="lg-pill"
        data-entered={entered ? "1" : "0"}
        data-hidden={showForm ? "1" : "0"}
      >
        {/* Countdown ring sits ON the pill's outer edge — replaces
            the old faint border. Two rect strokes share the same
            outline:
              - track: always-visible faint navy, so the pill never
                appears borderless mid-cycle.
              - fill:  bolder navy, animated 0 → full perimeter via
                stroke-dashoffset over one cycle.
            pathLength=100 normalizes the perimeter so dasharray
            works in clean 0-100 units regardless of the pill's
            actual size. React reset-mounts the SVG each cycle
            (via `key={cycleStartedAt}`) so the animation restarts
            cleanly. */}
        <svg
          key={cycleStartedAt}
          aria-hidden
          className="lg-pill__ring"
          style={{ ["--cycle-ms" as never]: `${cycleMs}ms` }}
        >
          <rect
            className="lg-pill__ring-track"
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="999"
            ry="999"
            fill="none"
            stroke="var(--navy)"
            strokeOpacity="0.18"
            strokeWidth="2"
          />
          <rect
            className="lg-pill__ring-fill"
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="999"
            ry="999"
            pathLength={100}
            fill="none"
            stroke="var(--navy)"
            strokeOpacity="0.65"
            strokeWidth="2"
            strokeDasharray="100"
            strokeDashoffset="100"
            strokeLinecap="round"
          />
        </svg>
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
          /* The old 1px navy border is replaced by the SVG ring
           * track inside .lg-pill__ring — keeps a clean visual
           * edge while letting the ring fill animate on top. */
          border: none;
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
        /* SVG countdown ring traced around the pill. Sits absolutely
         * inside the button, fills it edge to edge, doesn't intercept
         * clicks. */
        .lg-pill__ring {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: visible;
        }
        .lg-pill__ring-fill {
          /* Drains from invisible (offset=100) to fully drawn
           * (offset=0) over one cycle. Visually: a navy stroke
           * traces clockwise around the pill's edge as the next
           * rotation approaches. */
          animation: lg-ring-fill var(--cycle-ms, 10000ms) linear forwards;
        }
        @keyframes lg-ring-fill {
          from {
            stroke-dashoffset: 100;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-pill__ring-fill {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
        /* Hide the ring while the form is shown (pill is fading out
         * anyway, no point drawing the countdown). */
        .lg-pill[data-hidden="1"] .lg-pill__ring {
          opacity: 0;
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
