import Link from "next/link";
import type { ReactNode } from "react";
import MobileNavMenu from "@/components/admin/MobileNavMenu";

export const metadata = {
  title: "Admin · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-[color:var(--rule)] bg-white/60 print:hidden">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-7 py-4 flex items-center gap-4 md:gap-8">
          <Link href="/admin" className="font-sans font-bold text-navy text-[15px] tracking-tight whitespace-nowrap">
            UWC · Admin
          </Link>
          <nav className="flex items-center gap-4 md:gap-5 text-[13px] tracking-[.12em] uppercase font-semibold text-[color:var(--navy-ink)]">
            <Link href="/admin" className="hover:text-navy">Overview</Link>
            <Link href="/admin/alumni" className="hover:text-navy">Alumni</Link>
            <span className="hidden md:contents">
              <Link href="/admin/events" className="hover:text-navy">Events</Link>
              <Link href="/admin/email/campaigns" className="hover:text-navy">Email</Link>
              <Link href="/admin/tools" className="hover:text-navy">Tools</Link>
              <Link href="/admin/analytics" className="hover:text-navy">Analytics</Link>
            </span>
          </nav>
          <Link href="/" className="hidden md:inline-block ml-auto text-[12px] tracking-[.2em] uppercase text-[color:var(--muted)] hover:text-navy">
            ← Site
          </Link>
          <MobileNavMenu />
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-5 sm:px-7 py-10 print:max-w-none print:p-0 print:m-0">
        {children}
      </main>
    </div>
  );
}
