import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import LoginBackdrop, { type BackdropId } from "@/components/login/LoginBackdrop";
import LoadingGate from "@/components/login/LoadingGate";
import {
  buildFlagTiles,
  buildOrgTiles,
  buildPhotoTiles,
  buildTilePool,
  buildUwcTiles,
} from "@/components/login/faces-shared";
import DirectoryLoginForm from "./DirectoryLoginForm";

export const dynamic = "force-dynamic";
// Belt and suspenders: never cache this page or any of its data
// fetches. The animated backdrop should sample a fresh photo subset
// from the full alumni pool on every visit.
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Directory access · UWC Bay Area",
  description: "Read-only access to the UWC Bay Area alumni directory.",
  robots: { index: false, follow: false },
};

/** Target unique-tile count for Mosaic + Constellation. Mosaic has
 * ~120 cells × 2 sides (front + back), so the pool needs to be big
 * enough for unique assignments. 240 covers it comfortably. */
const MIXED_POOL_SIZE = 240;
/** Query the full alumni-with-photos set on every visit (~406 today)
 * so the photo sample varies as much as possible between page loads.
 * The pool builder + per-request seed pick a different ~240 subset
 * for the mixed pool, and the photoPool that feeds the Living Wall
 * is re-shuffled per request below. */
const PHOTO_QUERY_SIZE = 1000;

/** Alumni whose LinkedIn profile picture is actually a school crest
 * or company logo — the file lives at /alumni-photos/<id>.jpg (so
 * the URL-based NOT IN can't catch it) but the image content is a
 * logo. Add an id here when you spot another one. Long-term we can
 * promote this to an admin checkbox on the alumni record. */
const EXCLUDE_FROM_LOGIN_PHOTOS = [99];

/**
 * Sign-in surface. Server-fetches the alumni photo / UWC logo / org
 * logo / flag pools, mixes them at the 60/25/10/5 ratio, and hands
 * the combined pool to the rotating backdrop. The form itself stays
 * a thin client component owning only the credential flow.
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

  // UWC logos come from a frozen hardcoded list in faces-shared
  // (`UWC_LOGOS`) — exactly 18, no DB lookup, no name-variant noise.
  const [photoRows, orgRows, originRows] = await Promise.all([
    sql`
      -- Exclude alumni whose "profile photo" is actually a school or
      -- company logo (some folks set their LinkedIn picture to the
      -- UWC USA crest, NYU Abu Dhabi mark, etc.). Without this they
      -- showed up rotating in the Constellation as "the only logo
      -- that appears, every time."
      SELECT id, first_name, last_name, photo_url
      FROM alumni
      WHERE photo_url IS NOT NULL
        AND first_name IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE
        AND moved_out IS NOT TRUE
        AND id != ALL(${EXCLUDE_FROM_LOGIN_PHOTOS}::int[])
        AND photo_url NOT IN (
          SELECT school_logo_url
          FROM alumni_education
          WHERE school_logo_url IS NOT NULL
          UNION
          SELECT current_company_logo_url
          FROM alumni
          WHERE current_company_logo_url IS NOT NULL
          UNION
          SELECT company_logo_url
          FROM alumni_career
          WHERE company_logo_url IS NOT NULL
        )
      ORDER BY RANDOM()
      LIMIT ${PHOTO_QUERY_SIZE}
    `,
    sql`
      -- Same idea: dedup by logo URL, not by name. Two companies in
      -- the DB with slightly different names but the same LinkedIn
      -- logo (e.g. "Google" vs "Google LLC") become one tile.
      SELECT MIN(name) AS name, logo, SUM(n)::int AS total FROM (
        SELECT current_company AS name,
               current_company_logo_url AS logo,
               COUNT(*)::int AS n
        FROM alumni
        WHERE current_company IS NOT NULL
          AND current_company_logo_url IS NOT NULL
          AND affiliation ILIKE '%alum%'
          AND deceased IS NOT TRUE
        GROUP BY current_company, current_company_logo_url
        UNION ALL
        SELECT school AS name, school_logo_url AS logo, COUNT(*)::int AS n
        FROM alumni_education
        WHERE is_uwc IS NOT TRUE
          AND school_logo_url IS NOT NULL
        GROUP BY school, school_logo_url
      ) u
      GROUP BY logo
      ORDER BY total DESC
      LIMIT 80
    `,
    sql`
      SELECT DISTINCT origin
      FROM alumni
      WHERE origin IS NOT NULL AND TRIM(origin) <> ''
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE
    `,
  ]);

  const photos = buildPhotoTiles(
    photoRows as Array<{
      id: number;
      first_name: string | null;
      last_name: string | null;
      photo_url: string | null;
    }>,
  );
  const uwcs = buildUwcTiles();
  const orgs = buildOrgTiles(
    orgRows as Array<{ name: string; logo: string | null }>,
  );
  const flags = buildFlagTiles(originRows as Array<{ origin: string }>);
  // Fisher-Yates shuffle the full photo list per request so every
  // backdrop sees a different ordering. The Living Wall slices
  // contiguously from the start, the buildTilePool re-shuffles
  // internally for the mixed pool — both benefit.
  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }

  // Mixed pool (60/25/10/5 mix, deduplicated, photos fill any gaps)
  // — used by Mosaic + Constellation.
  const mixedPool = buildTilePool({
    target: MIXED_POOL_SIZE,
    photos,
    uwcs,
    orgs,
    flags,
    seed: Math.floor(Math.random() * 0xffffffff),
  });
  // Living Wall is photos-only per design — no UWC / org / flag tiles.
  const photoPool = photos;

  const initialBackdrop: BackdropId = (
    ["living", "mosaic", "constellation"] as BackdropId[]
  )[Math.floor(Math.random() * 3)];

  // Image URLs the LoadingGate uses to gauge "enough loaded to show
  // the page". These must match what the backdrops actually request
  // (Vercel-optimized URLs at the right width per backdrop), so the
  // preloads and the live tile <img> tags hit the same cache entry.
  const opt = (u: string, w: number) =>
    u.endsWith(".svg") ? u : `/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=70`;
  const preloadUrls: string[] = [];
  // Living Wall + Constellation: photoPool at the larger Constellation
  // width (384) covers both — Living Wall's 256-px request will hit
  // the same cached optimization once it's already served at 384,
  // and the cost difference is negligible at scale.
  for (const t of photoPool) {
    if (t.kind === "photo") preloadUrls.push(opt(t.imgUrl, 384));
  }
  // Mosaic: logos + flags at 192px.
  for (const t of mixedPool) {
    if (t.kind === "uwc" || t.kind === "org") {
      if (t.imgUrl) preloadUrls.push(opt(t.imgUrl, 192));
    } else if (t.kind === "flag") {
      preloadUrls.push(t.svgUrl);
    }
  }

  return (
    <div
      className="min-h-screen relative isolate"
      style={{ background: "var(--rich-deep)" }}
    >
      <LoadingGate urls={preloadUrls} threshold={0.5}>
      <LoginBackdrop
        mixedPool={mixedPool}
        photoPool={photoPool}
        initial={initialBackdrop}
      />

      {/* Transparent header on the dark backdrop */}
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
            UWC Bay Area<span className="hidden sm:inline"> · Directory</span>
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

      {/* Centered sign-in card — tightened for desktop + mobile */}
      <main className="relative z-[2] min-h-screen flex items-center justify-center px-5 py-20">
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
      </main>
      </LoadingGate>
    </div>
  );
}
