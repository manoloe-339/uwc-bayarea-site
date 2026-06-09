import Link from "next/link";
import { FeedbackButton } from "@/components/directory/FeedbackButton";

export const dynamic = "force-dynamic";

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            <FeedbackButton />
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
