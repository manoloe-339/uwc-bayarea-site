"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import DirectorySetupForm from "./DirectorySetupForm";

interface Props {
  token: string;
  email: string;
  /** Pulled from alumni.first_name via the directory_users.alumni_id
   * join in the page. May be null if the invite was created without
   * a linked alumni record, in which case the pill falls back to
   * just "Welcome". */
  firstName: string | null;
  /** Lifted state, same shape LoginGateCard uses, so the page-level
   * shell can poll / pause backdrop refreshes based on it. */
  showForm: boolean;
  onShowFormChange: (next: boolean) => void;
  cycleStartedAt: number;
  cycleMs: number;
}

/**
 * Two-state setup surface — mirrors LoginGateCard exactly, just with
 * a "Welcome, [firstName]" pill and a password-setup card inside
 * the crossfade. The invitee gets the same arrival ritual as
 * returning users, so the directory's visual identity is consistent
 * from the very first touch.
 */
export default function SetupGateCard({
  token,
  email,
  firstName,
  showForm,
  onShowFormChange,
  cycleStartedAt,
  cycleMs,
}: Props) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

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

  const pillLabel = firstName ? `Welcome, ${firstName}` : "Welcome";

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        onClick={() => onShowFormChange(true)}
        aria-label="Set up your directory password"
        tabIndex={showForm ? -1 : 0}
        className="lg-pill"
        data-entered={entered ? "1" : "0"}
        data-hidden={showForm ? "1" : "0"}
      >
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
        <span className="lg-pill__label">{pillLabel}</span>
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

      <div
        className="lg-card"
        data-visible={showForm ? "1" : "0"}
        aria-hidden={!showForm}
      >
        <div
          className="w-full max-w-[360px] rounded-[12px] p-5 sm:p-6"
          style={{
            background: "rgba(255,255,255,.97)",
            border: "1px solid rgba(11,37,69,.08)",
            boxShadow:
              "0 2px 0 var(--ivory-3), 0 30px 60px -30px rgba(11,37,69,.5)",
          }}
        >
          <div className="flex items-center gap-2 text-navy font-bold text-[10px] tracking-[.22em] uppercase">
            <span className="inline-block w-5 h-0.5 bg-navy" aria-hidden />
            Welcome
          </div>
          <h1
            className="text-[color:var(--navy-ink)] mt-2 font-extrabold leading-[1.04]"
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "clamp(22px, 5vw, 28px)",
              letterSpacing: "-.025em",
            }}
          >
            Set your password
          </h1>
          <div className="mt-4">
            <DirectorySetupForm
              token={token}
              email={email}
              shouldFocus={showForm}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        /* All styles match LoginGateCard exactly so the visual
         * vocabulary (pill, ring, breathing, crossfade) is identical
         * for first-time invitees as for returning sign-ins. */
        .lg-pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 16px 24px;
          border-radius: 999px;
          font-family: Inter, system-ui, sans-serif;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--navy-ink);
          background: rgba(255, 255, 255, 0.97);
          border: none;
          box-shadow: 0 16px 36px -18px rgba(11, 37, 69, 0.6);
          cursor: pointer;
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
        .lg-pill__track {
          stroke: rgba(11, 37, 69, 0.2);
          stroke-width: 3px;
        }
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
          from { stroke-dashoffset: 100; }
          to   { stroke-dashoffset: 0; }
        }
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
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -100; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-pill__fill {
            animation: none;
            stroke-dashoffset: 0;
            filter: none;
          }
          .lg-pill__head { display: none; }
          .lg-pill[data-entered="1"] { animation: none; }
        }
        .lg-pill[data-hidden="1"] .lg-pill__ring { opacity: 0; }

        .lg-pill__dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--navy);
          box-shadow: 0 0 0 4px rgba(2, 101, 168, 0.14);
        }
        .lg-pill__label { line-height: 1; }
        .lg-pill__arrow {
          color: var(--navy);
          transition: transform 240ms cubic-bezier(0.2, 0.7, 0.2, 1);
        }
        .lg-pill:hover .lg-pill__arrow { transform: translateX(3px); }

        @keyframes lg-breathe {
          0%, 100% { box-shadow: 0 16px 36px -18px rgba(11, 37, 69, 0.6); }
          50%      { box-shadow: 0 24px 50px -20px rgba(11, 37, 69, 0.65); }
        }
        @media (max-width: 640px) {
          .lg-pill {
            padding: 14px 22px;
            font-size: 12.5px;
            gap: 12px;
          }
          .lg-pill__dot { width: 6px; height: 6px; }
        }

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
