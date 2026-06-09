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
import { getSaveForAlumnus, REASON_LABELS, STATUS_LABELS } from "@/lib/directory-saves";
import { linkedinHref } from "@/lib/linkedin-url";
import SaveStar from "@/components/directory/SaveStar";
import { CompanyLogo } from "@/components/directory/CompanyLogo";
import LinkedinIconLink from "@/components/directory/LinkedinIconLink";
import { originCountryNames, originFlagString } from "@/lib/country-flag";
import {
  detectMovedFromBayArea,
  formatLocationForDisplay,
  pickCurrentLocation,
} from "@/lib/location-moved";
import { displayName, titleCase } from "@/lib/text-format";

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


export default async function DirectoryProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const row = await getDirectoryAlumnus(id);
  if (!row) notFound();

  const careers = await getDirectoryCareers(id);
  const education = await getDirectoryEducation(id);

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

  return (
    <section className="max-w-[800px] mx-auto px-5 sm:px-7 py-8">
      <div className="mb-5 text-sm">
        <Link
          href="/directory"
          className="text-[color:var(--muted)] hover:text-navy"
        >
          ← Back to directory
        </Link>
      </div>

      {existingSave && canSave && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-3 text-xs text-amber-900">
          <span className="font-bold">★ On your shortlist</span>
          {" — "}
          <span>Status: {STATUS_LABELS[existingSave.status]}</span>
          {existingSave.reason && (
            <span>{" · "}Reason: {REASON_LABELS[existingSave.reason]}</span>
          )}
          {existingSave.note && (
            <div className="mt-1 italic text-[color:var(--muted)]">
              &ldquo;{existingSave.note}&rdquo;
            </div>
          )}
        </div>
      )}

      <div className="relative bg-white border border-[color:var(--rule)] rounded-[10px] p-6 sm:p-8">
        <SaveStar
          alumniId={id}
          alumName={name}
          initial={existingSave}
          canSave={canSave}
          size={28}
          className="absolute top-3 right-3"
        />
        <div className="flex items-start gap-5 mb-6 pr-10">
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div className="w-[110px] h-[110px] rounded-full overflow-hidden bg-[color:var(--ivory-2)] ring-[3px] ring-navy">
              {row.photo_url ? (
                <Image
                  src={row.photo_url}
                  alt=""
                  width={110}
                  height={110}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[color:var(--muted)] text-2xl font-bold">
                  {name
                    .split(" ")
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
              )}
            </div>
            {row.origin && originFlagString(row.origin) && (
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className="text-[28px] leading-none text-black"
                  style={{ fontVariantEmoji: "emoji" }}
                  aria-label={`From ${originCountryNames(row.origin) ?? row.origin}`}
                >
                  {originFlagString(row.origin)}
                </span>
                <span className="text-[11px] text-[color:var(--muted)] text-center max-w-[120px]">
                  {originCountryNames(row.origin) ?? row.origin}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-sans text-[28px] font-bold text-[color:var(--navy-ink)] leading-[1.1]">
              <span className="block">{titleCase(row.first_name) || "—"}</span>
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="truncate min-w-0" title={titleCase(row.last_name)}>
                  {titleCase(row.last_name)}
                </span>
                {linkedin ? (
                  <LinkedinIconLink
                    href={linkedin}
                    alumniId={id}
                    className="shrink-0 inline-flex items-center justify-center w-[22px] h-[22px] rounded-[3px] bg-[#0A66C2] text-white text-[11px] font-bold hover:brightness-110 leading-none align-middle"
                  />
                ) : (
                  <span
                    className="shrink-0 inline-flex items-center justify-center w-[22px] h-[22px] rounded-[3px] bg-[color:var(--ivory-2)] text-[color:var(--muted)] text-[11px] font-bold leading-none align-middle"
                    title="No LinkedIn on file"
                  >
                    in
                  </span>
                )}
              </span>
            </h1>
            <div className="mt-2.5 space-y-1 text-[color:var(--navy-ink)]">
              {sub && (
                <div className="text-[15px] font-semibold leading-tight">
                  {sub}
                </div>
              )}
              {location && (
                <div className="text-sm text-[color:var(--muted)]">
                  {location}
                  {fellBackToLinkedin && (
                    <span className="text-[color:var(--muted)] italic">
                      {" "}(per LinkedIn)
                    </span>
                  )}
                </div>
              )}
              {(() => {
                const moved = detectMovedFromBayArea(linkedinLoc);
                // Don't double-show: if LinkedIn IS the primary
                // location, the 🧳 badge would just repeat it.
                if (!moved || fellBackToLinkedin) return null;
                return (
                  <div
                    className="text-sm text-[color:var(--muted)]"
                    title="LinkedIn says they're now somewhere else"
                  >
                    🧳 {formatLocationForDisplay(moved)}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {row.headline && (
          <p className="text-sm text-[color:var(--navy-ink)] italic mb-3 leading-[1.4]">
            {row.headline}
          </p>
        )}

        {row.linkedin_about && (
          <div className="mb-5">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
              Bio
            </div>
            <p className="text-sm text-[color:var(--navy-ink)] leading-[1.55] whitespace-pre-wrap">
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
    </section>
  );
}
