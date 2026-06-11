"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoginBackdrop, {
  type BackdropId,
} from "@/components/login/LoginBackdrop";
import type { LoginTile } from "@/components/login/faces-shared";
import LoadingGate from "@/components/login/LoadingGate";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import DirectorySetupForm from "./DirectorySetupForm";

interface Props {
  /** Pre-fetched pools so initial paint matches what the login page
   * shows when the invitee follows the link. */
  initialPools: { photoPool: LoginTile[]; mixedPool: LoginTile[] };
  initialBackdrop: BackdropId;
  initialPreloadUrls: string[];
  /** Invite token from the URL. Passed through to the form so it can
   * be submitted with the new password. */
  token: string;
  /** The invitee's email — displayed read-only as a confirmation. */
  email: string;
}

const REFRESH_MS = 30_000;

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
 * Wraps the directory setup form (invite-token password setup) with
 * the same animated backdrop the /directory/login page uses. The
 * invitee gets the full visual context — they're sitting in front
 * of the directory they're about to access — while the centered
 * white card prompts them for a new password.
 */
export default function SetupExperience({
  initialPools,
  initialBackdrop,
  initialPreloadUrls,
  token,
  email,
}: Props) {
  const [pools, setPools] = useState(initialPools);

  // Same poll-and-swap as LoginExperience so the backdrop keeps
  // refreshing while the invitee thinks about their password.
  useEffect(() => {
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
  }, []);

  return (
    <LoadingGate urls={initialPreloadUrls} threshold={0.5}>
      <LoginBackdrop
        mixedPool={pools.mixedPool}
        photoPool={pools.photoPool}
        initial={initialBackdrop}
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
          <p className="text-[color:var(--muted)] text-[12px] leading-snug mt-2">
            You&rsquo;ll use this with your email (
            <span className="text-[color:var(--navy-ink)] font-semibold">
              {email}
            </span>
            ) to sign into the UWC Bay Area Directory beta. Minimum 8
            characters.
          </p>
          <div className="mt-4">
            <DirectorySetupForm token={token} email={email} />
          </div>
        </div>
      </main>
    </LoadingGate>
  );
}
