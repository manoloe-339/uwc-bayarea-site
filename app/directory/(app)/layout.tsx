import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import LogoutButton from "@/components/directory/LogoutButton";
import DirectoryHamburger from "@/components/directory/DirectoryHamburger";
import { Icon } from "@/components/directory/Icon";
import MobileDirectoryNav from "@/components/directory/MobileDirectoryNav";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getSavedCount(userId: number): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM directory_saves WHERE directory_user_id = ${userId}
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

async function getFirstName(alumniId: number | null): Promise<string | null> {
  if (!alumniId) return null;
  const rows = (await sql`
    SELECT first_name FROM alumni WHERE id = ${alumniId} LIMIT 1
  `) as Array<{ first_name: string | null }>;
  return rows[0]?.first_name?.trim() || null;
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
  const isUser = session?.kind === "user";
  const userAlumniId = isUser ? session!.user.alumni_id : null;
  const [savedCount, firstName] = await Promise.all([
    isUser ? getSavedCount(session!.user.id) : Promise.resolve(0),
    getFirstName(userAlumniId ?? null),
  ]);

  return (
    // Matches the /directory/login + /directory/setup pages so the
    // whole directory lives on the same rich-blue ground. Inner
    // content cards stay white for legibility.
    <div
      className="min-h-screen"
      style={{ background: "var(--rich-blue)" }}
    >
      {/* ============ Desktop header (≥ md) ============ */}
      <header className="hidden md:block bg-white border-b border-[color:var(--rule)]">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-7 py-3 flex items-center justify-between gap-3">
          <Link
            href="/directory"
            className="text-[12px] tracking-[.32em] uppercase font-bold text-navy hover:opacity-80 truncate"
          >
            UWC Bay Area<span className="hidden sm:inline"> · Directory</span>
          </Link>

          <div className="flex items-center gap-5">
            <Link
              href="/directory"
              className="text-[12px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] hover:text-navy"
            >
              Search
            </Link>
            <Link
              href="/directory/snapshot"
              className="text-[12px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] hover:text-navy"
            >
              Snapshot
            </Link>
            {isUser && (
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
                  <Icon name="message-square" size={14} strokeWidth={2} />
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
        </div>
      </header>

      {/* ============ Mobile header (< md) ============
         A single navy/translucent block carrying the directory's
         identity (ALUMNI DIRECTORY eyebrow + Welcome) and primary
         nav. The desktop white bar above doesn't render here, so
         Feedback and the overflow menu live in this block instead. */}
      <div className="md:hidden px-[18px] pt-[18px] pb-[10px] text-white relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold tracking-[.2em] uppercase text-white/60">
              UWC Bay Area Alumni Directory
            </div>
            <h1
              className="m-0 leading-[1] tracking-[-0.02em] text-white"
              style={{
                fontFamily: "Fraunces, Georgia, serif",
                fontWeight: 800,
                fontSize: 25,
              }}
            >
              {firstName ? `Welcome, ${firstName}` : "Welcome"}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <FeedbackButton
              triggerClassName="inline-flex items-center justify-center w-[42px] h-[42px] rounded-full text-white"
              triggerStyle={{
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.22)",
              }}
              triggerLabel={
                <Icon name="message-square" size={18} strokeWidth={2} />
              }
            />
            {session && (
              <DirectoryHamburger
                isUserAccount={isUser}
                hasSession={!!session}
                /* Show only the overflow items on mobile — Search /
                   Snapshot / Saved live in the segmented nav now. */
                mobileOverflowOnly
              />
            )}
          </div>
        </div>

        {session && (
          <MobileDirectoryNav
            savedCount={savedCount}
            showSaved={isUser}
          />
        )}
      </div>

      <main>{children}</main>
    </div>
  );
}
