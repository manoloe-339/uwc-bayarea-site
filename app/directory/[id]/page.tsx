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
import { SaveButton } from "@/components/directory/SaveButton";
import { CompanyLogo } from "@/components/directory/CompanyLogo";
import { originFlagString } from "@/lib/country-flag";

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

  const name =
    [row.first_name, row.last_name].filter(Boolean).join(" ") || "(no name)";
  const sub = [row.uwc_college, row.grad_year].filter(Boolean).join(" · ");
  const location = [row.current_city, row.region].filter(Boolean).join(" · ");
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

      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 sm:p-8">
        <div className="flex items-start gap-5 mb-6">
          <div className="shrink-0 w-[110px] h-[110px] rounded-full overflow-hidden bg-[color:var(--ivory-2)]">
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
          <div className="min-w-0 flex-1">
            <h1 className="font-sans text-[28px] font-bold text-[color:var(--navy-ink)] leading-[1.1]">
              {name}
            </h1>
            <div className="mt-2.5 space-y-1 text-[color:var(--navy-ink)]">
              {sub && (
                <div className="text-[15px] font-semibold leading-tight">
                  {sub}
                </div>
              )}
              {row.origin && (
                <div className="text-[15px] leading-tight">
                  {originFlagString(row.origin) && (
                    <span className="mr-1.5 text-[18px] align-[-2px]" aria-hidden>
                      {originFlagString(row.origin)}
                    </span>
                  )}
                  From {row.origin}
                </div>
              )}
              {location && (
                <div className="text-sm text-[color:var(--muted)]">
                  {location}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {linkedin ? (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#0A66C2] text-white px-4 py-2 rounded text-xs font-bold tracking-[.18em] uppercase hover:opacity-90"
                >
                  LinkedIn Profile
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 border border-dashed border-[color:var(--rule)] text-[color:var(--muted)] px-4 py-2 rounded text-xs font-bold tracking-[.18em] uppercase">
                  No LinkedIn on file
                </span>
              )}
            </div>
            <div className="mt-3">
              <SaveButton
                alumniId={id}
                initial={existingSave}
                canSave={canSave}
                variant="banner"
              />
            </div>
          </div>
        </div>

        {row.headline && (
          <p className="text-sm text-[color:var(--navy-ink)] italic mb-3 leading-[1.4]">
            {row.headline}
          </p>
        )}

        {(row.current_title || row.current_company) && (
          <div className="mb-5">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
              Now
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[color:var(--navy-ink)]">
              {row.current_company && (
                <CompanyLogo
                  storedLogoUrl={row.current_company_logo_url}
                  website={row.current_company_website}
                  linkedinUrl={row.current_company_linkedin}
                  companyName={row.current_company}
                  size={28}
                />
              )}
              <div>
                {row.current_title}
                {row.current_title && row.current_company && " at "}
                {row.current_company}
                {row.current_company_industry && (
                  <span className="text-[color:var(--muted)]">
                    {" · "}
                    {row.current_company_industry}
                  </span>
                )}
              </div>
            </div>
          </div>
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
                const companyName = companyDisplayName(cc);
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
