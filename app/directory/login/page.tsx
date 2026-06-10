import type { Metadata } from "next";
import { type BackdropId } from "@/components/login/LoginBackdrop";
import { buildLoginData } from "@/lib/login-data";
import LoginExperience from "./LoginExperience";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Directory access · UWC Bay Area",
  description: "Read-only access to the UWC Bay Area alumni directory.",
  robots: { index: false, follow: false },
};

/**
 * Server entry for /directory/login. Pulls the initial backdrop pool
 * from Postgres and hands everything to the client LoginExperience,
 * which from then on polls /api/directory/login-pool every 30 s and
 * swaps in fresh pools without reloading.
 */
export default async function DirectoryLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next =
    typeof sp.next === "string" && sp.next.startsWith("/directory")
      ? sp.next
      : "/directory";

  const initialPools = await buildLoginData();
  const initialBackdrop: BackdropId = (
    ["living", "mosaic", "constellation"] as BackdropId[]
  )[Math.floor(Math.random() * 3)];

  // Image URLs that the LoadingGate uses on the first page render to
  // gauge "enough loaded to show the page". After that the polling
  // pool-swap doesn't pass through the gate — newly-introduced tiles
  // just appear as the browser fetches them.
  const opt = (u: string, w: number) =>
    u.endsWith(".svg") ? u : `/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=70`;
  const initialPreloadUrls: string[] = [];
  for (const t of initialPools.photoPool) {
    if (t.kind === "photo") initialPreloadUrls.push(opt(t.imgUrl, 384));
  }
  for (const t of initialPools.mixedPool) {
    if (t.kind === "uwc" || t.kind === "org" || t.kind === "flag") {
      if (t.imgUrl) initialPreloadUrls.push(opt(t.imgUrl, 256));
    }
  }

  return (
    <div
      className="min-h-screen relative isolate"
      style={{ background: "var(--rich-deep)" }}
    >
      <LoginExperience
        initialPools={initialPools}
        initialBackdrop={initialBackdrop}
        initialPreloadUrls={initialPreloadUrls}
        next={next}
      />
    </div>
  );
}
