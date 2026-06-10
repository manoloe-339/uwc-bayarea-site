import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import LoginBackdrop, { type BackdropId } from "@/components/login/LoginBackdrop";
import {
  buildFlagTiles,
  buildOrgTiles,
  buildPhotoTiles,
  buildTilePool,
  buildUwcTiles,
} from "@/components/login/faces-shared";
import DirectoryLoginForm from "./DirectoryLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Directory access · UWC Bay Area",
  description: "Read-only access to the UWC Bay Area alumni directory.",
  robots: { index: false, follow: false },
};

const TARGET_POOL_SIZE = 100;

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

  const [photoRows, uwcRows, orgRows, originRows] = await Promise.all([
    sql`
      SELECT id, first_name, last_name, photo_url
      FROM alumni
      WHERE photo_url IS NOT NULL
        AND first_name IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE
        AND moved_out IS NOT TRUE
      ORDER BY RANDOM()
      LIMIT 80
    `,
    sql`
      SELECT school, MAX(school_logo_url) AS logo
      FROM alumni_education
      WHERE is_uwc = true
      GROUP BY school
    `,
    sql`
      SELECT name, MAX(logo) AS logo, SUM(n)::int AS total FROM (
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
      GROUP BY name
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
  const uwcs = buildUwcTiles(
    uwcRows as Array<{ school: string; logo: string | null }>,
  );
  const orgs = buildOrgTiles(
    orgRows as Array<{ name: string; logo: string | null }>,
  );
  const flags = buildFlagTiles(originRows as Array<{ origin: string }>);
  const pool = buildTilePool({
    target: TARGET_POOL_SIZE,
    photos,
    uwcs,
    orgs,
    flags,
    seed: Math.floor(Math.random() * 0xffffffff),
  });

  const initialBackdrop: BackdropId = (
    ["living", "mosaic", "constellation"] as BackdropId[]
  )[Math.floor(Math.random() * 3)];

  return (
    <div
      className="min-h-screen relative isolate"
      style={{ background: "var(--rich-deep)" }}
    >
      <LoginBackdrop pool={pool} initial={initialBackdrop} />

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

      {/* Centered sign-in card */}
      <main className="relative z-[2] min-h-screen flex items-center justify-center px-5 py-24">
        <div
          className="w-full max-w-[440px] rounded-[18px] p-9 sm:p-[38px]"
          style={{
            background: "rgba(255,255,255,.97)",
            border: "1px solid rgba(11,37,69,.08)",
            boxShadow:
              "0 2px 0 var(--ivory-3), 0 40px 80px -40px rgba(11,37,69,.5)",
          }}
        >
          <div className="flex items-center gap-3.5 text-navy font-bold text-[13px] tracking-[.22em] uppercase">
            <span className="inline-block w-9 h-0.5 bg-navy" aria-hidden />
            Directory access
          </div>
          <h1
            className="text-[color:var(--navy-ink)] mt-5 font-extrabold leading-[1]"
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "clamp(38px, 8vw, 52px)",
              letterSpacing: "-.03em",
            }}
          >
            Sign in
          </h1>
          <p className="text-[color:var(--muted)] text-[17px] leading-[1.5] mt-4 max-w-[42ch]">
            Read-only directory for trusted organizers. Lookup &amp; LinkedIn
            links only — no email or phone exposed.
          </p>
          <div className="mt-7">
            <DirectoryLoginForm next={next} />
          </div>
        </div>
      </main>
    </div>
  );
}
