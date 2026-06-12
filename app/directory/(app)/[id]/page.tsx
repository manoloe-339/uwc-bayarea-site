import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getDirectoryAlumnus,
  getDirectoryCareers,
  getDirectoryEducation,
  logDirectoryProfileView,
} from "@/lib/directory-query";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import { getSaveForAlumnus } from "@/lib/directory-saves";
import { linkedinHref } from "@/lib/linkedin-url";
import SaveStar from "@/components/directory/SaveStar";
import { CompanyLogo } from "@/components/directory/CompanyLogo";
import { Icon } from "@/components/directory/Icon";
import { FlagCoins } from "@/components/directory/Coins";
import { extractCountryCodes } from "@/lib/country-flag";
import {
  detectMovedFromBayArea,
  formatLocationForDisplay,
  pickCurrentLocation,
} from "@/lib/location-moved";
import { displayName, titleCase } from "@/lib/text-format";
import {
  getFlagMap,
  getUwcLogoMap,
  stripUwcPrefix,
} from "@/lib/directory-lookups";

export const dynamic = "force-dynamic";

/** Derive a readable company name from a LinkedIn company URL when the
 * scraped `company` string is missing. LinkedIn's `/company/<slug>/`
 * pattern is reliable; "the-world-bank-group" → "The World Bank Group". */
function deriveCompanyFromLinkedinUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/company\/([^/?#]+)/i);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).replace(/-+/g, " ").trim();
  if (!slug) return null;
  // Title-case each word.
  return slug
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function companyDisplayName(cc: {
  company: string | null;
  company_linkedin_url: string | null;
}): string | null {
  const direct = cc.company?.trim();
  if (direct) return direct;
  return deriveCompanyFromLinkedinUrl(cc.company_linkedin_url);
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Apify returns career dates as "M-YYYY" or "MM-YYYY" (e.g.
 * "5-2024", "05-2024", "11-2020"). Normalize to "May 2024". Falls
 * back to the raw string when the format doesn't match — better to
 * show something than nothing. */
function fmtCareerDate(d: string | null): string {
  if (!d) return "";
  const raw = d.trim();
  const m = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) {
    const month = Number(m[1]);
    if (month >= 1 && month <= 12) {
      return `${MONTH_NAMES[month - 1]} ${m[2]}`;
    }
  }
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) return yearOnly[1];
  return raw;
}

function careerRange(
  start: string | null,
  end: string | null,
  isCurrent: boolean | null,
): string {
  const s = fmtCareerDate(start);
  const endTrim = (end ?? "").trim();
  const e = isCurrent || !endTrim ? "Present" : fmtCareerDate(endTrim);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}


type SP = { [k: string]: string | string[] | undefined };

/** Decide where "← Back" should go. The list pages stamp a `from`
 * search param on every detail link they emit; that param is the
 * full path (with its own search string) to go back to. Anything
 * else — direct hits, bookmarks — falls back to the bare directory. */
function pickBack(sp: SP): { href: string; label: string } {
  const rawFrom = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const from = rawFrom?.trim();
  // Only allow same-app, /directory-rooted paths to avoid open-redirect-y
  // surprises and not link out anywhere unexpected.
  if (from && from.startsWith("/directory")) {
    if (from.startsWith("/directory/saved")) {
      return { href: from, label: "← Back to shortlist" };
    }
    return { href: from, label: "← Back to directory" };
  }
  return { href: "/directory", label: "← Back to directory" };
}

export default async function DirectoryProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id: idStr } = await params;
  const sp = await searchParams;
  const back = pickBack(sp);
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const row = await getDirectoryAlumnus(id);
  if (!row) notFound();

  const [careers, education, uwcLogos, flags] = await Promise.all([
    getDirectoryCareers(id),
    getDirectoryEducation(id),
    getUwcLogoMap(),
    getFlagMap(),
  ]);

  // Identity + audit
  const session = await getCurrentDirectorySession();
  const userId = session?.kind === "user" ? session.user.id : null;
  const sessionId = session?.auditSessionId ?? "";
  if (sessionId) {
    void logDirectoryProfileView(sessionId, id, userId);
  }

  // Existing save state (if any) so the ★ Save button shows current values.
  const existingSave = userId ? await getSaveForAlumnus(userId, id) : null;
  const canSave = session?.kind === "user";

  const name = displayName(row.first_name, row.last_name);
  const sub = [row.uwc_college, row.grad_year].filter(Boolean).join(" · ");
  // Prefer the LinkedIn-derived "where they actually are now" — job
  // location first, profile location next — so the displayed
  // location reflects their current job rather than the signup-time
  // current_city (which is often stale once people move). Fall back
  // to the registered city when no LinkedIn signal is available.
  // Primary location = what the alum typed at signup (authoritative
  // for "where they consider home"). LinkedIn-derived location is
  // only used as a fallback when signup is empty, AND surfaces via
  // the 🧳 badge below when it disagrees (i.e. they've moved out of
  // the Bay Area per LinkedIn).
  const signupCity = row.current_city
    ? formatLocationForDisplay(titleCase(row.current_city))
    : null;
  const linkedinLoc = pickCurrentLocation({
    current_location: row.current_location,
    location_full: row.location_full,
  });
  const formattedLinkedin = linkedinLoc
    ? formatLocationForDisplay(linkedinLoc)
    : null;
  const location = signupCity ?? formattedLinkedin ?? "";
  const fellBackToLinkedin = !signupCity && !!formattedLinkedin;
  const linkedin = linkedinHref(row.linkedin_url);

  // Editorial-header derivations.
  const originIsos = extractCountryCodes(row.origin);
  const movedFrom = detectMovedFromBayArea(linkedinLoc);
  const showMovedPill = !!movedFrom && !fellBackToLinkedin;
  const movedLabel = movedFrom ? formatLocationForDisplay(movedFrom) : null;
  const campusDisplay = stripUwcPrefix(row.uwc_college);
  const uwcLogoUrl = row.uwc_college ? uwcLogos[row.uwc_college] : undefined;
  const cityHref = row.current_city
    ? `/directory?city=${encodeURIComponent(titleCase(row.current_city))}`
    : null;
  const campusHref = row.uwc_college
    ? `/directory?college=${encodeURIComponent(row.uwc_college)}`
    : null;
  const headerCompanyHref = linkedinHref(row.current_company_linkedin);

  return (
    <section className="max-w-[720px] mx-auto px-5 sm:px-7 py-7">
      <div className="mb-4 text-[15px]">
        <Link
          href={back.href}
          className="inline-flex items-center gap-[9px] text-white/80 hover:text-white"
        >
          <Icon name="arrow-left" size={18} strokeWidth={2} />
          {back.label.replace(/^←\s*/, "")}
        </Link>
      </div>

      <article className="bg-white rounded-[18px] overflow-hidden shadow-[0_2px_0_rgba(2,28,56,.4),0_40px_80px_-36px_rgba(0,0,0,.6)]">
        <header className="flex flex-col-reverse sm:flex-row gap-5 sm:gap-8 p-7 sm:p-9 pb-0">
          <div className="flex-1 min-w-0">
            <h1
              className="text-[color:var(--navy-ink)] font-bold leading-[1] tracking-[-0.015em] m-0"
              style={{
                fontFamily: "Fraunces, Georgia, serif",
                fontSize: "clamp(34px, 6vw, 46px)",
              }}
            >
              {name}
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-9 gap-y-[18px] mt-6">
              {row.uwc_college && (
                <div>
                  {uwcLogoUrl ? (
                    <Link
                      href={campusHref ?? "#"}
                      title={row.uwc_college}
                      className="inline-flex hover:opacity-80"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={uwcLogoUrl}
                        alt={row.uwc_college}
                        className="h-[56px] sm:h-[72px] w-auto block"
                      />
                    </Link>
                  ) : (
                    <Link
                      href={campusHref ?? "#"}
                      className="text-navy font-bold text-[18px] hover:underline"
                    >
                      {campusDisplay || row.uwc_college}
                    </Link>
                  )}
                  {row.grad_year != null && (
                    <div className="mt-[9px] text-[10.5px] font-bold tracking-[.16em] uppercase text-[color:var(--muted-2)]">
                      Class of {row.grad_year}
                    </div>
                  )}
                </div>
              )}

              {originIsos.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-[.18em] uppercase text-[color:var(--muted-2)] mb-[6px]">
                    From
                  </div>
                  <div className="flex items-center gap-[7px] text-[15px] text-[color:var(--navy-ink)] font-semibold">
                    <FlagCoins isos={originIsos} flags={flags} size={21} />
                    <span>
                      {originIsos
                        .map(
                          (iso) =>
                            flags[iso.toLowerCase()]?.name ?? iso.toUpperCase(),
                        )
                        .join(" · ")}
                    </span>
                  </div>
                </div>
              )}

              {(location || showMovedPill) && (
                <div>
                  <div className="text-[10px] font-bold tracking-[.18em] uppercase text-[color:var(--muted-2)] mb-[6px]">
                    Lives
                  </div>
                  <div className="flex items-center flex-wrap gap-[7px] text-[15px] text-[color:var(--navy-ink)] font-semibold">
                    {location &&
                      (cityHref ? (
                        <Link
                          href={cityHref}
                          className="text-navy hover:underline underline-offset-2"
                        >
                          {location}
                        </Link>
                      ) : (
                        <span>{location}</span>
                      ))}
                    {showMovedPill && (
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-[color:var(--muted-2)] border border-[color:var(--rule)] rounded-full px-2 py-[2px]"
                        title={`LinkedIn says they're now in ${movedLabel}`}
                      >
                        <Icon name="plane-takeoff" size={12} />
                        may have moved
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(row.current_title || row.current_company) && (
                <div>
                  <div className="text-[10px] font-bold tracking-[.18em] uppercase text-[color:var(--muted-2)] mb-[6px]">
                    Currently
                  </div>
                  <div className="text-[15px] text-[color:var(--navy-ink)]">
                    {row.current_title && (
                      <div className="text-[color:var(--muted)] font-medium">
                        {row.current_title}
                      </div>
                    )}
                    {row.current_company && (
                      <div className="font-semibold">
                        {headerCompanyHref ? (
                          <a
                            href={headerCompanyHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-navy hover:underline underline-offset-2"
                          >
                            {row.current_company}
                          </a>
                        ) : (
                          row.current_company
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-[10px] mt-[26px]">
              {linkedin && (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-[7px] rounded-[9px] bg-[#0A66C2] text-white font-semibold text-[13.5px] px-[15px] py-[10px] hover:brightness-[1.08]"
                >
                  <Icon name="linkedin" size={15} filled />
                  LinkedIn
                </a>
              )}
              <SaveStar
                alumniId={id}
                alumName={name}
                initial={existingSave}
                canSave={canSave}
                variant="button"
              />
            </div>
          </div>

          <div className="shrink-0 sm:w-[210px] w-full">
            <div
              className="w-full sm:h-[262px] h-[300px] rounded-[14px] overflow-hidden bg-[color:var(--ivory-2)]"
              style={{
                boxShadow:
                  "0 2px 0 var(--ivory-3), 0 18px 36px -18px rgba(11,37,69,.45)",
              }}
            >
              {row.photo_url ? (
                <Image
                  src={row.photo_url}
                  alt=""
                  width={420}
                  height={524}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "50% 24%" }}
                  unoptimized
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white"
                  style={{
                    background:
                      "radial-gradient(circle at 36% 28%, #3a86d0, #134a82 62%, #0b2545)",
                    fontFamily: "Fraunces, Georgia, serif",
                    fontSize: 72,
                    fontWeight: 600,
                  }}
                >
                  {name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="px-7 sm:px-9 pt-7 pb-9 mt-7 border-t border-[color:var(--rule)]">

        {row.headline && (
          <p
            className="italic text-[color:var(--navy-ink)] mb-6 mt-0 leading-[1.5]"
            style={{
              fontFamily: "Fraunces, Georgia, serif",
              fontWeight: 500,
              fontSize: 18,
            }}
          >
            {row.headline}
          </p>
        )}

        {row.linkedin_about && (
          <div className="mb-7">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
              Bio
            </div>
            <p className="text-[16px] text-[color:var(--navy-ink)] leading-[1.6] whitespace-pre-wrap m-0">
              {row.linkedin_about}
            </p>
          </div>
        )}

        {careers.length > 0 && (
          <div className="mb-2">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
              Career
            </div>
            <ol className="relative border-l-2 border-[color:var(--rule)] pl-5 space-y-4">
              {careers.map((cc, i) => {
                const companyHref = linkedinHref(cc.company_linkedin_url);
                // For the current job (is_current=true), fall back to
                // the alum's current_company if the career row's
                // company field is missing — some Apify rows come back
                // with title but no companyName for founder/self-
                // employed entries (Rebecca Bahr's "Founder" row).
                const companyName =
                  companyDisplayName(cc) ??
                  (cc.is_current ? row.current_company : null);
                const sizeLabel = cc.company_size
                  ? cc.company_size.replace(/\s+employees?\s*/i, "").trim()
                  : null;
                const meta = [cc.company_industry, sizeLabel ? `${sizeLabel} employees` : null, cc.location]
                  .filter(Boolean)
                  .join(" · ");
                const dateRange = careerRange(
                  cc.start_date,
                  cc.end_date,
                  cc.is_current,
                );
                return (
                  <li
                    key={`${cc.alumni_id}-${i}`}
                    className="relative text-sm text-[color:var(--navy-ink)]"
                  >
                    <span
                      aria-hidden
                      className={`absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
                        cc.is_current
                          ? "bg-navy border-navy"
                          : "bg-white border-[color:var(--rule)]"
                      }`}
                    />
                    {cc.title && (
                      <div className="font-semibold leading-tight">
                        {cc.title}
                      </div>
                    )}
                    {companyName && (
                      <div className="flex items-center gap-2 text-[color:var(--navy-ink)]">
                        <CompanyLogo
                          storedLogoUrl={cc.company_logo_url}
                          website={cc.company_website}
                          linkedinUrl={cc.company_linkedin_url}
                          companyName={companyName}
                          size={20}
                        />
                        {companyHref ? (
                          <a
                            href={companyHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {companyName}
                          </a>
                        ) : (
                          <span>{companyName}</span>
                        )}
                      </div>
                    )}
                    {meta && (
                      <div className="text-xs text-[color:var(--muted)]">
                        {meta}
                      </div>
                    )}
                    {dateRange && (
                      <div className="text-[11px] text-[color:var(--muted)] mt-0.5 tabular-nums">
                        {dateRange}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {education.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
              Education
            </div>
            <ul className="space-y-3">
              {education.map((ed, i) => {
                const schoolHref = linkedinHref(ed.school_linkedin_url);
                const range = [ed.start_year, ed.end_year]
                  .filter((y): y is number => typeof y === "number" && y > 0)
                  .join(" – ");
                return (
                  <li
                    key={`${ed.alumni_id}-edu-${i}`}
                    className="flex items-start gap-2.5 text-sm text-[color:var(--navy-ink)]"
                  >
                    <CompanyLogo
                      storedLogoUrl={ed.school_logo_url}
                      website={null}
                      linkedinUrl={ed.school_linkedin_url}
                      companyName={ed.school}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-tight">
                        {ed.school && schoolHref ? (
                          <a
                            href={schoolHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {ed.school}
                          </a>
                        ) : (
                          <span>{ed.school ?? "—"}</span>
                        )}
                      </div>
                      {ed.degree_field && (
                        <div className="text-xs text-[color:var(--muted)]">
                          {ed.degree_field}
                        </div>
                      )}
                      {range && (
                        <div className="text-[11px] text-[color:var(--muted)] mt-0.5 tabular-nums">
                          {range}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        </div>
      </article>
    </section>
  );
}
