import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import LogoutButton from "@/components/directory/LogoutButton";
import DirectoryHamburger from "@/components/directory/DirectoryHamburger";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getSavedCount(userId: number): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM directory_saves WHERE directory_user_id = ${userId}
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

// Suppress iOS Safari's auto-linking of addresses / phone numbers /
// dates / emails in the directory. Cities like "Cambridge, England"
// were being underlined and rendered as Maps links — annoying because
// none of these are actionable map locations, just biographical data.
export const metadata: Metadata = {
  other: {
    "format-detection": "telephone=no, address=no, email=no, date=no",
  },
};

export default async function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentDirectorySession();
  const savedCount =
    session?.kind === "user" ? await getSavedCount(session.user.id) : 0;

  return (
    // Matches the /directory/login + /directory/setup pages so the
    // whole directory lives on the same rich-blue ground. Inner
    // content cards stay white for legibility.
    <div
      className="min-h-screen"
      style={{ background: "var(--rich-blue)" }}
    >
      <header className="bg-white border-b border-[color:var(--rule)]">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-7 py-3 flex items-center justify-between gap-3">
          <Link
            href="/directory"
            className="text-[12px] tracking-[.32em] uppercase font-bold text-navy hover:opacity-80 truncate"
          >
            UWC Bay Area<span className="hidden sm:inline"> · Directory</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-5">
            <Link
              href="/directory/snapshot"
              className="text-[12px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] hover:text-navy"
            >
              Snapshot
            </Link>
            {session?.kind === "user" && (
              <Link
                href="/directory/saved"
                className="text-[12px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] hover:text-navy"
              >
                Saved
              </Link>
            )}
            <FeedbackButton
              triggerClassName="inline-flex items-center gap-1.5 text-[12px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] hover:text-navy"
              triggerLabel={
                <>
                  <span aria-hidden role="img">💬</span>
                  Feedback
                </>
              }
            />
            {session && <LogoutButton />}
            <Link
              href="/"
              className="text-[12px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] hover:text-navy"
            >
              ← uwcbayarea.org
            </Link>
          </div>

          {/* Mobile nav — feedback + shortlist-shortcut always visible
              alongside the hamburger, never buried in the menu. The
              star appears only once the user has saved something so
              first-timers find their shortlist without hunting. */}
          <div className="md:hidden flex items-center gap-1">
            <FeedbackButton
              triggerClassName="inline-flex items-center justify-center w-9 h-9 rounded text-navy hover:bg-[color:var(--ivory-2)] text-[18px] leading-none"
              triggerLabel={
                <span aria-hidden role="img">💬</span>
              }
            />
            {savedCount > 0 && (
              <Link
                href="/directory/saved"
                aria-label={`Your shortlist (${savedCount})`}
                title={`Your shortlist (${savedCount})`}
                className="relative inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[color:var(--ivory-2)]"
                style={{ color: "#D97706" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.6l-5.9 3.07 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-navy text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {savedCount > 99 ? "99+" : savedCount}
                </span>
              </Link>
            )}
            <DirectoryHamburger
              isUserAccount={session?.kind === "user"}
              hasSession={!!session}
            />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
