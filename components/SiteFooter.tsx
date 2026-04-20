import Link from "next/link";

const CONTACT_EMAIL = "manoloe@gmail.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=UWC%20Bay%20Area%20help`;

export default function SiteFooter() {
  return (
    <footer className="bg-navy text-white/85">
      <div className="max-w-[1200px] mx-auto px-7 py-7 flex flex-wrap items-center justify-between gap-4 text-[13px]">
        <Link href="/" className="flex items-center text-white no-underline" aria-label="UWC Bay Area home">
          <img
            src="/uwc-bay-area-logo.jpg"
            alt="UWC Bay Area · Alumni & Friends"
            className="h-9 w-auto block rounded-sm"
          />
        </Link>
        <div className="flex flex-wrap gap-4 sm:gap-[18px]">
          <FooterLink href="/">Home</FooterLink>
          <FooterLink href="/">Events</FooterLink>
          <FooterLink href="/signup">Sign up</FooterLink>
          <FooterLink href={CONTACT_MAILTO}>{CONTACT_EMAIL}</FooterLink>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className =
    "text-white/75 hover:text-white no-underline text-[12px] tracking-[.22em] uppercase font-semibold";
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
