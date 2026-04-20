import Link from "next/link";

type NavKey = "home" | "events" | "signup" | "contact";

const CONTACT_MAILTO = "mailto:manoloe@gmail.com?subject=UWC%20Bay%20Area%20help";

const links: { key: NavKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "events", label: "Events", href: "/" },
  { key: "signup", label: "Sign up", href: "/signup" },
  { key: "contact", label: "Contact", href: CONTACT_MAILTO },
];

export default function SiteHeader({ active }: { active?: NavKey }) {
  return (
    <nav
      className="sticky top-0 z-50 bg-navy text-white border-b border-white/10 relative
        after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5
        after:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,.35)_20%,rgba(255,255,255,.35)_80%,transparent_100%)]"
    >
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-6 px-5 sm:px-7 py-[14px] sm:py-[18px]">
        <Link href="/" className="flex items-center text-white no-underline" aria-label="UWC Bay Area home">
          <img
            src="/uwc-bay-area-logo.png"
            alt="UWC Bay Area · Alumni & Friends"
            className="h-[46px] sm:h-[52px] w-auto block rounded-sm"
          />
        </Link>

        <div className="flex items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.key} href={l.href} active={active === l.key}>
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  const base =
    "no-underline text-[12px] sm:text-[13px] tracking-[.08em] uppercase font-semibold " +
    "px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-md transition-colors transition-[background] duration-150";
  const state = active
    ? "text-white bg-white/10 relative after:content-[''] after:block after:h-0.5 after:bg-white after:mt-1.5 after:rounded-sm"
    : "text-white/80 hover:text-white hover:bg-white/10";
  const className = `${base} ${state}`;
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
