import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import LogoutButton from "@/components/directory/LogoutButton";
import DirectoryHamburger from "@/components/directory/DirectoryHamburger";
import { getCurrentDirectorySession } from "@/lib/directory-session";

export const dynamic = "force-dynamic";

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

  return (
    <div className="min-h-screen bg-[color:var(--ivory)]">
      <header className="bg-white border-b border-[color:var(--rule)]">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-7 py-3 flex items-center justify-between gap-3">
          <Link
            href="/directory"
            className="text-[12px] tracking-[.32em] uppercase font-bold text-navy hover:opacity-80 truncate"
          >
            <span className="hidden sm:inline">UWC Bay Area · </span>Directory
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

          {/* Mobile nav — feedback always visible alongside the
              hamburger, never buried in the menu. */}
          <div className="md:hidden flex items-center gap-1">
            <FeedbackButton
              triggerClassName="inline-flex items-center justify-center w-9 h-9 rounded text-navy hover:bg-[color:var(--ivory-2)] text-[18px] leading-none"
              triggerLabel={
                <span aria-hidden role="img">💬</span>
              }
            />
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
