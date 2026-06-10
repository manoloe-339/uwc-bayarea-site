"use client";

import { useEffect, useState } from "react";
import LoginBackdrop, { type BackdropId } from "@/components/login/LoginBackdrop";
import type { LoginTile } from "@/components/login/faces-shared";
import LoadingGate from "@/components/login/LoadingGate";
import LoginGateCard from "./LoginGateCard";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import Link from "next/link";

interface Props {
  initialPools: { photoPool: LoginTile[]; mixedPool: LoginTile[] };
  initialBackdrop: BackdropId;
  initialPreloadUrls: string[];
  next: string;
}

const REFRESH_MS = 30_000;

/** Collect every URL the new pool's tiles will render. Mirrors the
 * widths the backdrops actually request (384 for photos in Living
 * Wall + Constellation, 256 for everything in Mosaic) so the
 * preload hits the same cache entries the live <img>s will. */
function collectPoolUrls(pools: {
  photoPool: LoginTile[];
  mixedPool: LoginTile[];
}): string[] {
  const opt = (u: string, w: number) =>
    u.endsWith(".svg")
      ? u
      : `/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=70`;
  const out = new Set<string>();
  for (const t of pools.photoPool) {
    if (t.kind === "photo") out.add(opt(t.imgUrl, 384));
  }
  for (const t of pools.mixedPool) {
    if (t.kind === "uwc" || t.kind === "org" || t.kind === "flag") {
      if (t.imgUrl) out.add(opt(t.imgUrl, 256));
    }
  }
  return Array.from(out);
}

/** Warm the browser cache for every URL the new pool will render.
 * Resolves when `threshold` fraction have settled (loaded or
 * errored) OR when `maxMs` elapses, whichever comes first — so an
 * unusually slow image doesn't block the swap indefinitely. */
function warmImageCache(
  pools: { photoPool: LoginTile[]; mixedPool: LoginTile[] },
  threshold: number,
  maxMs: number,
): Promise<void> {
  const urls = collectPoolUrls(pools);
  if (urls.length === 0) return Promise.resolve();
  const target = Math.max(1, Math.ceil(urls.length * threshold));
  return new Promise<void>((resolve) => {
    let settled = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const onOne = () => {
      settled++;
      if (settled >= target) finish();
    };
    for (const u of urls) {
      const img = new window.Image();
      img.onload = onOne;
      img.onerror = onOne;
      img.src = u;
    }
    setTimeout(finish, maxMs);
  });
}

/**
 * Top-level client wrapper for /directory/login. Owns two pieces of
 * state the previous reload-based design couldn't share cleanly:
 *
 *   pools     — the photo / mixed pools driving the backdrops. Server
 *               hands us an initial value; while the user is idle
 *               (Log in pill visible) we poll the JSON API every 30s
 *               and swap in a fresh pool. No page reload, no
 *               LoadingGate flash, no React unmount of the backdrops
 *               — just new <img src> values, which the browser swaps
 *               smoothly (old image stays visible until the new one
 *               loads).
 *   showForm  — flips when the user clicks the Log in pill. While
 *               true, polling pauses so we don't yank tiles around
 *               while they're signing in.
 */
/** Backdrop cycle length — must match ROTATE_MS in LoginBackdrop.
 * The pill's ring countdown uses this to compute progress. */
const CYCLE_MS = 10_000;

export default function LoginExperience({
  initialPools,
  initialBackdrop,
  initialPreloadUrls,
  next,
}: Props) {
  const [pools, setPools] = useState(initialPools);
  const [showForm, setShowForm] = useState(false);
  // Timestamp of the current backdrop's start. LoginBackdrop fires
  // onCycleStart whenever the active backdrop changes, including the
  // initial mount, so this stays in lockstep with the rotation.
  const [cycleStartedAt, setCycleStartedAt] = useState<number>(() =>
    Date.now(),
  );

  useEffect(() => {
    if (showForm) return;
    const tick = async () => {
      try {
        const res = await fetch("/api/directory/login-pool", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          photoPool: LoginTile[];
          mixedPool: LoginTile[];
        };
        // PRELOAD before swap. If we just setState() right away, each
        // <img src> swap on the Living Wall + Mosaic + Constellation
        // happens at its own pace — fast for cached URLs, slow for
        // cold ones — so for a beat the user sees a mix of old + new
        // tiles. Warming the browser cache first means every src
        // update resolves instantly from cache, so all tiles
        // visually swap in lockstep.
        await warmImageCache(data, 0.75, 5_500);
        setPools(data);
      } catch {
        // Silently ignore — next tick will retry.
      }
    };
    const t = setInterval(tick, REFRESH_MS);
    return () => clearInterval(t);
  }, [showForm]);

  return (
    <LoadingGate urls={initialPreloadUrls} threshold={0.5}>
      <LoginBackdrop
        mixedPool={pools.mixedPool}
        photoPool={pools.photoPool}
        initial={initialBackdrop}
        onCycleStart={() => setCycleStartedAt(Date.now())}
      />

      <header className="fixed top-0 left-0 right-0 z-[60] h-16 flex items-center">
        <div
          aria-hidden
          className="absolute inset-0 -bottom-7 -z-[1] pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(6,32,63,.9), rgba(6,32,63,0))",
          }}
        />
        <div className="w-full max-w-[1280px] mx-auto px-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-white font-extrabold tracking-[.24em] uppercase text-[15px] sm:text-[15px] hover:opacity-90"
          >
            UWC Bay Area
            <span className="hidden sm:inline"> · Directory</span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-7">
            <Link
              href="/directory/snapshot"
              className="hidden sm:inline-flex text-white/80 hover:text-white text-[12px] tracking-[.2em] uppercase font-bold"
            >
              Snapshot
            </Link>
            <FeedbackButton
              triggerClassName="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-[12px] tracking-[.2em] uppercase font-bold"
              triggerLabel={
                <>
                  <span aria-hidden role="img">
                    💬
                  </span>
                  <span className="hidden xs:inline">Feedback</span>
                </>
              }
            />
            <Link
              href="/"
              className="hidden sm:inline-flex text-white/80 hover:text-white text-[12px] tracking-[.2em] uppercase font-bold"
            >
              ← uwcbayarea.org
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-[2] min-h-screen flex items-center justify-center px-5 py-20">
        <LoginGateCard
          next={next}
          showForm={showForm}
          onShowFormChange={setShowForm}
          cycleStartedAt={cycleStartedAt}
          cycleMs={CYCLE_MS}
        />
      </main>
    </LoadingGate>
  );
}
