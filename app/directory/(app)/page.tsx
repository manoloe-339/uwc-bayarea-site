import Link from "next/link";
import { COLLEGES } from "@/lib/uwc-colleges";
import { REGIONS } from "@/lib/region";
import {
  searchDirectoryAlumni,
  countDirectoryAlumni,
  logDirectorySearch,
  type DirectoryFilters,
  type DirectoryAlumnusRow,
} from "@/lib/directory-query";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import { linkedinHref } from "@/lib/linkedin-url";
import { parseSearchQuery, type ParsedSearchQuery } from "@/lib/event-nl-parser";
import { listSavesForUser } from "@/lib/directory-saves";
import type { SaveReason, SaveStatus } from "@/lib/directory-saves-shared";
import SaveStar from "@/components/directory/SaveStar";
import { AlumGalleryCard, type AlumCardData } from "@/components/directory/AlumGalleryCard";
import { DirectoryNLToggle } from "@/components/directory/DirectoryNLToggle";
import { extractCountryCodes } from "@/lib/country-flag";
import {
  detectMovedFromBayArea,
  pickCurrentLocation,
} from "@/lib/location-moved";
import { displayName, titleCase } from "@/lib/text-format";
import {
  getFlagMap,
  getUwcLogoMap,
  stripUwcPrefix,
} from "@/lib/directory-lookups";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };

function pickStr(sp: SP, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}
function pickNum(sp: SP, key: string): number | undefined {
  const s = pickStr(sp, key);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Filter-field classname. Frosted-glass baseline; when `active`
 * the border and tint brighten so a glance at the form tells you
 * which filters are constraining the result set. */
function fieldClass(active: boolean, kind: "input" | "select" = "input"): string {
  const base = kind === "select" ? "fp-select" : "fp-input";
  return active ? `${base} ${base}--active` : base;
}
function fieldClassLg(active: boolean): string {
  return active ? "fp-input fp-input--lg fp-input--active" : "fp-input fp-input--lg";
}

/** Build a list of human-readable chips for every filter currently
 * constraining the result set. Empty array means no filters applied. */
function activeFilterChips(
  f: DirectoryFilters,
): Array<{ key: string; label: string }> {
  const chips: Array<{ key: string; label: string }> = [];
  if (f.q) chips.push({ key: "q", label: `"${f.q}"` });
  if (f.name) chips.push({ key: "name", label: `name: ${f.name}` });
  if (f.college) chips.push({ key: "college", label: f.college });
  if (f.region) chips.push({ key: "region", label: f.region });
  if (f.yearFrom != null || f.yearTo != null) {
    const from = f.yearFrom != null ? String(f.yearFrom) : "…";
    const to = f.yearTo != null ? String(f.yearTo) : "…";
    chips.push({ key: "grad", label: `grad ${from}–${to}` });
  }
  if (f.industry) chips.push({ key: "industry", label: f.industry });
  if (f.companySizeBand) {
    const sizeLabels: Record<string, string> = {
      startup: "Startup (1–50)",
      small: "Small (51–500)",
      mid: "Mid (501–5K)",
      large: "Large (5K–50K)",
      enterprise: "Enterprise (50K+)",
    };
    chips.push({
      key: "size",
      label: sizeLabels[f.companySizeBand] ?? f.companySizeBand,
    });
  }
  if (f.expBand) {
    const expLabels: Record<string, string> = {
      "0-3": "0–3 yrs",
      "3-7": "3–7 yrs",
      "7-15": "7–15 yrs",
      "15+": "15+ yrs",
    };
    chips.push({ key: "exp", label: expLabels[f.expBand] ?? f.expBand });
  }
  if (f.city) chips.push({ key: "city", label: `city: ${f.city}` });
  if (f.origin) chips.push({ key: "origin", label: `origin: ${f.origin}` });
  if (f.company) chips.push({ key: "company", label: `company: ${f.company}` });
  if (f.university) chips.push({ key: "university", label: `uni: ${f.university}` });
  return chips;
}

/** Translate a Claude-parsed query into our directory filter shape.
 * Only assigns fields that map cleanly to the directory's allowlist.
 * The NL parser also emits things like subscription/engagement filters
 * elsewhere in the codebase; those don't exist on ParsedSearchQuery
 * for the search-mode prompt today, but the explicit-fields approach
 * below means a future field addition can't silently leak. */
function applyParsedSearch(
  base: DirectoryFilters,
  parsed: ParsedSearchQuery,
): DirectoryFilters {
  const next: DirectoryFilters = { ...base };
  if (parsed.college) next.college = parsed.college;
  if (parsed.region) next.region = parsed.region;
  if (parsed.origin) next.origin = parsed.origin;
  if (parsed.minGradYear) next.yearFrom = parsed.minGradYear;
  if (parsed.maxGradYear) next.yearTo = parsed.maxGradYear;
  if (parsed.companyName) next.company = parsed.companyName;
  if (parsed.university) next.university = parsed.university;
  // The NL parser produces `industryGroups: IndustryGroup[]`. Take the
  // first one as our single-select directory filter; in practice a user
  // rarely needs more than one industry group via NL.
  if (parsed.industryGroups && parsed.industryGroups.length > 0) {
    next.industryGroup = parsed.industryGroups[0];
  }
  // The NL parser captures `city` separately; fold it into the broad
  // search so the existing OR on current_city / location_full picks it up.
  const cityChunk = parsed.city ? parsed.city : null;
  if (cityChunk) {
    next.q = next.q ? `${next.q} ${cityChunk}` : cityChunk;
  }
  return next;
}

async function applyNaturalLanguage(
  filters: DirectoryFilters,
): Promise<DirectoryFilters> {
  if (!filters.q) return filters;
  const result = await parseSearchQuery(filters.q);
  if (!result.ok) return filters;
  return applyParsedSearch(filters, result.parsed);
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const nl = pickStr(sp, "nl") === "1";

  const baseFilters: DirectoryFilters = {
    q: pickStr(sp, "q"),
    name: pickStr(sp, "name"),
    college: pickStr(sp, "college"),
    region: pickStr(sp, "region"),
    origin: pickStr(sp, "origin"),
    yearFrom: pickNum(sp, "yearFrom"),
    yearTo: pickNum(sp, "yearTo"),
    industryGroup: pickStr(sp, "industryGroup"),
    industry: pickStr(sp, "industry"),
    city: pickStr(sp, "city"),
    company: pickStr(sp, "company"),
    university: pickStr(sp, "university"),
    expBand: pickStr(sp, "expBand") as DirectoryFilters["expBand"],
    companySizeBand: pickStr(sp, "companySizeBand") as DirectoryFilters["companySizeBand"],
    industriesIncludePast: pickStr(sp, "industriesIncludePast") === "1",
  };

  const filters = nl ? await applyNaturalLanguage(baseFilters) : baseFilters;

  // Audit log every search except the initial empty load. Keeps the
  // log meaningful — every applied filter is a "user did a thing"
  // signal.
  const hasAnyFilter =
    !!filters.q ||
    !!filters.name ||
    !!filters.college ||
    !!filters.region ||
    !!filters.origin ||
    !!filters.industryGroup ||
    !!filters.industry ||
    !!filters.city ||
    !!filters.company ||
    !!filters.university ||
    !!filters.expBand ||
    filters.yearFrom != null ||
    filters.yearTo != null;
  const session = await getCurrentDirectorySession();
  const userId = session?.kind === "user" ? session.user.id : null;
  const sessionId = session?.auditSessionId ?? "";

  if (hasAnyFilter && sessionId) {
    void logDirectorySearch(sessionId, filters, userId);
  }

  // Fetch the logged-in user's own name for personalizing the Name
  // placeholder ("e.g. Manolo Espinosa — or just Espinosa"). Falls
  // back to the generic Jane Doe when there's no linked alumni row
  // (shared-password sessions, or per-user accounts not yet tied to
  // an alumni record).
  const currentUserAlumniId =
    session?.kind === "user" ? session.user.alumni_id : null;

  const [rows, total, mySaves, industries, currentUserName] = await Promise.all([
    searchDirectoryAlumni(filters, 500),
    countDirectoryAlumni(filters),
    userId ? listSavesForUser(userId) : Promise.resolve([]),
    sql`
      SELECT current_company_industry AS value, COUNT(*)::int AS count
      FROM alumni
      WHERE current_company_industry IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE
        AND moved_out IS NOT TRUE
      GROUP BY current_company_industry
      ORDER BY count DESC, current_company_industry ASC
      LIMIT 60
    ` as unknown as Promise<Array<{ value: string; count: number }>>,
    currentUserAlumniId
      ? (sql`SELECT first_name, last_name FROM alumni WHERE id = ${currentUserAlumniId} LIMIT 1` as unknown as Promise<
          Array<{ first_name: string | null; last_name: string | null }>
        >)
      : Promise.resolve([] as Array<{ first_name: string | null; last_name: string | null }>),
  ]);

  // Build a placeholder using the user's own name when available.
  const me = currentUserName[0];
  const namePlaceholder = (() => {
    const first = me?.first_name?.trim();
    const last = me?.last_name?.trim();
    if (first && last) return `${first} ${last} — or just ${last}`;
    if (last) return last;
    if (first) return first;
    return "Jane Doe — or just Doe";
  })();
  // Build a quick lookup: alumni_id -> existing save (for the ★ button state).
  const savedByAlumni = new Map<number, { status: typeof mySaves[number]["status"]; reasons: typeof mySaves[number]["reasons"]; note: string | null }>();
  for (const s of mySaves) {
    savedByAlumni.set(s.alumni_id, {
      status: s.status,
      reasons: s.reasons,
      note: s.note,
    });
  }
  const canSave = session?.kind === "user";
  const [uwcLogos, flags] = await Promise.all([
    getUwcLogoMap(),
    getFlagMap(),
  ]);

  // Build a "from" URL that recreates the current /directory view so
  // the detail page's ← Back link can return the user to exactly the
  // filtered result list they were just browsing. Only stringy +
  // non-empty params are forwarded — bare /directory hits stay clean.
  const fromParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s && s.trim()) fromParams.set(k, s.trim());
  }
  const fromQs = fromParams.toString();
  const directoryFrom = "/directory" + (fromQs ? `?${fromQs}` : "");

  return (
    <section className="max-w-[1180px] mx-auto px-5 sm:px-7 py-8">
      <div className="mb-6">
        <h1
          className="display text-white font-extrabold leading-[1.02] tracking-[-0.02em]"
          style={{ fontSize: "clamp(34px, 6vw, 54px)" }}
        >
          {me?.first_name?.trim()
            ? `Welcome, ${me.first_name.trim()}`
            : "Directory"}
        </h1>
        <p className="mt-2 text-[15px] sm:text-[17px] text-white/75">
          Search, and connect on LinkedIn.
        </p>
        <ul className="mt-2 space-y-0.5 text-[14px] sm:text-[15px] text-white/70">
          <li>
            Explore via{" "}
            <Link
              href="/directory/snapshot"
              className="underline decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white"
            >
              snapshot
            </Link>
            .
          </li>
          <li>
            Save alumni to your{" "}
            <Link
              href="/directory/saved"
              className="underline decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white"
            >
              shortlist
            </Link>
            .
          </li>
        </ul>
      </div>

      <form
        method="get"
        className="fp-panel p-5 sm:p-7 mb-6"
      >
        {nl && <input type="hidden" name="nl" value="1" />}

        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="fp-label">
            <span aria-hidden>{nl ? "🪄" : "🔎"}</span>
            {nl ? "Describe" : "Search"}
          </span>
          <DirectoryNLToggle on={nl} />
        </div>
        <input
          name="q"
          type="text"
          defaultValue={pickStr(sp, "q") ?? ""}
          placeholder={
            nl
              ? "designers in SF who used to work at Stripe"
              : "fintech, Stripe, designer"
          }
          className={fieldClassLg(!!filters.q)}
        />

        {!nl && (
          <>
            <div className="mt-5 mb-2">
              <span className="fp-label">
                <span aria-hidden>👤</span> Name
              </span>
            </div>
            <input
              name="name"
              type="text"
              defaultValue={pickStr(sp, "name") ?? ""}
              placeholder={namePlaceholder}
              className={fieldClassLg(!!filters.name)}
            />
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-5 mt-6">
          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>🌐</span> UWC
            </span>
            <select
              name="college"
              defaultValue={filters.college ?? ""}
              className={fieldClass(!!filters.college, "select")}
            >
              <option value="">Any</option>
              {COLLEGES.map((c) => (
                <option key={c.canonical} value={c.canonical}>
                  {c.short}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>🏙️</span> City
            </span>
            <input
              name="city"
              defaultValue={filters.city ?? ""}
              placeholder="San Francisco"
              className={fieldClass(!!filters.city)}
            />
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>🏷️</span> Company
            </span>
            <input
              name="company"
              defaultValue={filters.company ?? ""}
              placeholder="Stripe"
              className={fieldClass(!!filters.company)}
            />
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>🏛️</span> University
            </span>
            <input
              name="university"
              defaultValue={filters.university ?? ""}
              placeholder="Stanford"
              className={fieldClass(!!filters.university)}
            />
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>🌍</span> Origin
            </span>
            <input
              name="origin"
              defaultValue={filters.origin ?? ""}
              placeholder="Brazil"
              className={fieldClass(!!filters.origin)}
            />
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>💼</span> Industry
            </span>
            <select
              name="industry"
              defaultValue={filters.industry ?? ""}
              className={fieldClass(!!filters.industry, "select")}
            >
              <option value="">Any</option>
              {(industries as Array<{ value: string; count: number }>).map(
                (ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.value} ({ind.count})
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>🏢</span> Company size
            </span>
            <select
              name="companySizeBand"
              defaultValue={filters.companySizeBand ?? ""}
              className={fieldClass(!!filters.companySizeBand, "select")}
            >
              <option value="">Any</option>
              <option value="startup">Startup (1–50)</option>
              <option value="small">Small (51–500)</option>
              <option value="mid">Mid (501–5K)</option>
              <option value="large">Large (5K–50K)</option>
              <option value="enterprise">Enterprise (50K+)</option>
            </select>
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>⏱️</span> Experience
            </span>
            <select
              name="expBand"
              defaultValue={filters.expBand ?? ""}
              className={fieldClass(!!filters.expBand, "select")}
            >
              <option value="">Any</option>
              <option value="0-3">0–3 yrs (early)</option>
              <option value="3-7">3–7 yrs</option>
              <option value="7-15">7–15 yrs</option>
              <option value="15+">15+ yrs (senior)</option>
            </select>
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>🌉</span> Region
            </span>
            <select
              name="region"
              defaultValue={filters.region ?? ""}
              className={fieldClass(!!filters.region, "select")}
            >
              <option value="">Any</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>🎓</span> Grad year (from)
            </span>
            <input
              name="yearFrom"
              type="number"
              inputMode="numeric"
              defaultValue={filters.yearFrom ?? ""}
              placeholder="2010"
              className={fieldClass(filters.yearFrom != null)}
            />
          </label>

          <label className="flex flex-col min-w-0">
            <span className="fp-label mb-2">
              <span aria-hidden>🎓</span> Grad year (to)
            </span>
            <input
              name="yearTo"
              type="number"
              inputMode="numeric"
              defaultValue={filters.yearTo ?? ""}
              placeholder="2020"
              className={fieldClass(filters.yearTo != null)}
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-[14px] text-white/70">
            {total} {total === 1 ? "alum" : "alumni"}
            {total > 500 && " (showing first 500)"}
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/directory"
              className="text-[14px] text-white/70 hover:text-white"
            >
              Reset
            </Link>
            <button
              type="submit"
              className="bg-navy text-white px-6 py-[10px] rounded-[8px] text-[14px] font-bold hover:brightness-110 active:scale-[.97] transition"
            >
              Apply
            </button>
          </div>
        </div>
      </form>

      {(() => {
        const chips = activeFilterChips(filters);
        if (chips.length === 0) return null;
        return (
          <div className="mb-4 flex items-center flex-wrap gap-2 text-sm text-white">
            <span className="font-semibold">
              {total} {total === 1 ? "alum" : "alumni"} matching
            </span>
            {chips.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center bg-white/10 border border-white/40 text-white rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm"
              >
                {c.label}
              </span>
            ))}
          </div>
        );
      })()}

      <div className="grid gap-[22px] grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const alum = rowToAlumCard(r);
          return (
            <AlumGalleryCard
              key={r.id}
              alum={alum}
              uwcLogos={uwcLogos}
              flags={flags}
              backFrom={directoryFrom}
              star={
                <SaveStar
                  alumniId={r.id}
                  alumName={alum.displayName}
                  initial={savedByAlumni.get(r.id) ?? null}
                  canSave={canSave}
                />
              }
            />
          );
        })}
      </div>

      {rows.length === 0 && (
        <div className="fp-panel p-10 text-center text-white/70 text-sm">
          No alumni match those filters.
        </div>
      )}
    </section>
  );
}

/** Map a DirectoryAlumnusRow to the shared AlumGalleryCard shape. */
function rowToAlumCard(row: DirectoryAlumnusRow): AlumCardData {
  const name = displayName(row.first_name, row.last_name);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const liveLoc = pickCurrentLocation({
    current_location: row.current_location,
    location_full: row.location_full,
  });
  return {
    id: row.id,
    displayName: name,
    photoUrl: row.photo_url,
    initials,
    uwcCanonical: row.uwc_college,
    campus: stripUwcPrefix(row.uwc_college),
    gradYear: row.grad_year,
    originIsos: extractCountryCodes(row.origin),
    city: row.current_city ? titleCase(row.current_city) : null,
    moved: !!detectMovedFromBayArea(liveLoc),
    role: row.current_title,
    company: row.current_company,
    companyHref: linkedinHref(row.current_company_linkedin),
    linkedinHref: linkedinHref(row.linkedin_url),
  };
}
