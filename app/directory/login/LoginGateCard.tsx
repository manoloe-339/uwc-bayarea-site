"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

  // Measure the pill at layout time and rebuild the SVG path so it
  // traces an exact capsule (straight top/bottom, semicircle ends)
  // that hugs the live element. Using <rect rx=999> would oval the
  // capsule because rx/ry on a rect each clamp to half their axis
  // independently — there's no way to get a true capsule from a
  // single rect. The path d starts at top-center (M w/2 0) and
  // sweeps clockwise so the fill + bead originate at the top.
  const pillRef = useRef<HTMLButtonElement>(null);
  const [pathD, setPathD] = useState("");
  useLayoutEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 || h === 0) return;
      const r = h / 2;
      setPathD(
        `M ${w / 2} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
      );
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      {/* Idle pill */}
      <button
        ref={pillRef}
        type="button"
        onClick={() => onShowFormChange(true)}
        aria-label="Open sign-in form"
        tabIndex={showForm ? -1 : 0}
        className="lg-pill"
        data-entered={entered ? "1" : "0"}
        data-hidden={showForm ? "1" : "0"}
      >
        {/* Outline ring. Three stroked <path> elements share the
            same `d` so they trace an identical capsule:
              - track: always-on faint navy, so the pill keeps a
                clean static edge.
              - fill:  navy stroke, drawn arc grows from 0 → full
                perimeter via stroke-dashoffset over one cycle.
              - head:  a zero-length round dash → a glowing bead
                that sits exactly on the leading edge of fill.
            React reset-mounts the SVG on each new cycle (via
            `key={cycleStartedAt}`) so both animations restart
            cleanly and stay in lockstep.
            pathLength=100 normalizes the perimeter so dasharray
            works in clean 0-100 units regardless of pill size. */}
        <svg
          key={cycleStartedAt}
          aria-hidden
          className="lg-pill__ring"
          style={{ ["--cycle-ms" as never]: `${cycleMs}ms` }}
        >
          {pathD && (
            <>
              <path className="lg-pill__track" pathLength={100} d={pathD} />
              <path className="lg-pill__fill" pathLength={100} d={pathD} />
              <path className="lg-pill__head" pathLength={100} d={pathD} />
            </>
          )}
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
          gap: 14px;
          /* Equalized L/R padding — required for an axis-symmetric
           * capsule so the ring path's top-center start point lines
           * up with the visual top-center of the pill. */
          padding: 16px 24px;
          border-radius: 999px;
          font-family: Inter, system-ui, sans-serif;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--navy-ink);
          background: rgba(255, 255, 255, 0.97);
          /* The ring is the only outline. No CSS border, no inner
           * white highlight, no ivory lip — those previously painted
           * faint rims just outside the stroke and made the line
           * look tucked inside a halo. Just one soft drop shadow. */
          border: none;
          box-shadow: 0 16px 36px -18px rgba(11, 37, 69, 0.6);
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
          box-shadow: 0 22px 50px -16px rgba(11, 37, 69, 0.7);
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
        /* SVG countdown ring. Sits absolutely inside the button,
         * traces the live pill silhouette (path d is rebuilt from
         * offsetWidth/Height), and the stroke is CENTERED on the
         * edge so the line IS the visible frame. */
        .lg-pill__ring {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: visible;
        }
        .lg-pill__ring path {
          fill: none;
        }
        /* Track: always-on faint navy, gives the pill a clean
         * static edge between cycles. */
        .lg-pill__track {
          stroke: rgba(11, 37, 69, 0.2);
          stroke-width: 3px;
        }
        /* Fill: navy stroke that draws over one cycle. Tiny
         * drop-shadow gives the leading edge a hair of glow so it
         * reads cleanly against the white pill. */
        .lg-pill__fill {
          stroke: var(--navy);
          stroke-width: 3px;
          stroke-linecap: round;
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          filter: drop-shadow(0 0 2px rgba(2, 101, 168, 0.55));
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
        /* Head: a zero-length round dash → renders as a dot. Moves
         * via dashoffset 0 → -100 in sync with the fill's leading
         * edge. Stronger glow filter makes it read as a "fuse." */
        .lg-pill__head {
          stroke: #dcebfb;
          stroke-width: 5px;
          stroke-linecap: round;
          stroke-dasharray: 0.001 200;
          stroke-dashoffset: 0;
          filter:
            drop-shadow(0 0 3px var(--navy))
            drop-shadow(0 0 7px rgba(2, 101, 168, 0.85));
          animation: lg-head-travel var(--cycle-ms, 10000ms) linear forwards;
        }
        @keyframes lg-head-travel {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: -100;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-pill__fill {
            animation: none;
            stroke-dashoffset: 0;
            filter: none;
          }
          .lg-pill__head {
            display: none;
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
            box-shadow: 0 16px 36px -18px rgba(11, 37, 69, 0.6);
          }
          50% {
            box-shadow: 0 24px 50px -20px rgba(11, 37, 69, 0.65);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-pill[data-entered="1"] {
            animation: none;
          }
        }

        /* Mobile: pill ~10% smaller. Padding stays symmetric so the
         * ring path's top-center origin lines up visually. */
        @media (max-width: 640px) {
          .lg-pill {
            padding: 14px 22px;
            font-size: 12.5px;
            gap: 12px;
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
