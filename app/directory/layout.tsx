import Link from "next/link";
import { sql } from "@/lib/db";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import LogoutButton from "@/components/directory/LogoutButton";
import { getCurrentDirectorySession } from "@/lib/directory-session";

export const dynamic = "force-dynamic";

async function getSavedCount(userId: number): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM directory_saves WHERE directory_user_id = ${userId}
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

export default async function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentDirectorySession();
  const savedCount =
    session?.kind === "user" ? await getSavedCount(session.user.id) : 0;

  return (
    <div className="min-h-screen bg-[color:var(--ivory)]">
      <header className="bg-white border-b border-[color:var(--rule)]">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-7 py-3 flex items-center justify-between">
          <Link
            href="/directory"
            className="text-[12px] tracking-[.32em] uppercase font-bold text-navy hover:opacity-80"
          >
            UWC Bay Area · Directory
          </Link>
          <div className="flex items-center gap-5">
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
                Saved {savedCount > 0 ? `(${savedCount})` : ""}
              </Link>
            )}
            <FeedbackButton />
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
      <main>{children}</main>
    </div>
  );
}
