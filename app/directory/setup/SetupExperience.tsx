"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoginBackdrop, {
  type BackdropId,
} from "@/components/login/LoginBackdrop";
import type { LoginTile } from "@/components/login/faces-shared";
import LoadingGate from "@/components/login/LoadingGate";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import SetupGateCard from "./SetupGateCard";

interface Props {
  initialPools: { photoPool: LoginTile[]; mixedPool: LoginTile[] };
  initialBackdrop: BackdropId;
  initialPreloadUrls: string[];
  token: string;
  email: string;
  firstName: string | null;
}

const REFRESH_MS = 30_000;
const CYCLE_MS = 10_000;

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
    if (t.kind === "photo") out.add(opt(t.imgUrl, 256));
    else if (t.kind === "uwc" || t.kind === "org" || t.kind === "flag") {
      if (t.imgUrl) out.add(opt(t.imgUrl, 256));
    }
  }
  return Array.from(out);
}

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
 * Mirrors LoginExperience but for the /directory/setup page. The
 * invitee gets the same arrival ritual: dark backdrop running its
 * A→B→C rotation, transparent header, centered pill that says
 * "Welcome, [firstName] →" instead of "Log in", and clicking the
 * pill crossfades into the password-setup card.
 */
export default function SetupExperience({
  initialPools,
  initialBackdrop,
  initialPreloadUrls,
  token,
  email,
  firstName,
}: Props) {
  const [pools, setPools] = useState(initialPools);
  const [showForm, setShowForm] = useState(false);
  const [cycleStartedAt, setCycleStartedAt] = useState<number>(() => Date.now());

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
        await warmImageCache(data, 0.75, 5_500);
        setPools(data);
      } catch {
        // best-effort
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
            className="text-white font-extrabold tracking-[.24em] uppercase text-[15px] hover:opacity-90"
          >
            UWC Bay Area
            <span className="hidden sm:inline"> · Directory</span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-7">
            <FeedbackButton
              triggerClassName="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-[12px] tracking-[.2em] uppercase font-bold"
              triggerLabel={
                <>
                  <span aria-hidden role="img">💬</span>
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

      <main className="relative z-[2] min-h-[100dvh] flex items-center justify-center px-5 py-8">
        <SetupGateCard
          token={token}
          email={email}
          firstName={firstName}
          showForm={showForm}
          onShowFormChange={setShowForm}
          cycleStartedAt={cycleStartedAt}
          cycleMs={CYCLE_MS}
        />
      </main>
    </LoadingGate>
  );
}
