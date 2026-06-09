import Link from "next/link";
import Image from "next/image";
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
import { DirectoryNLToggle } from "@/components/directory/DirectoryNLToggle";
import { originCountryNames, originFlagString } from "@/lib/country-flag";
import {
  detectMovedFromBayArea,
  pickCurrentLocation,
} from "@/lib/location-moved";
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

/** Filter-field classname. When `active`, swap the white/grey
 * baseline for a navy-bordered, lightly-tinted "on" look so a glance
 * at the form tells you which filters are constraining the result
 * set. */
function fieldClass(active: boolean): string {
  return `w-full border rounded px-3 py-2 text-sm ${
    active
      ? "border-navy bg-[color:var(--ivory-2)] font-medium"
      : "border-[color:var(--rule)] bg-white"
  }`;
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
  if (f.industriesIncludePast) {
    chips.push({ key: "industryPast", label: "+ past roles" });
  }
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
    if (first && last) return `e.g. ${first} ${last} — or just ${last}`;
    if (last) return `e.g. ${last}`;
    if (first) return `e.g. ${first}`;
    return "e.g. Jane Doe — or just Doe";
  })();
  // Build a quick lookup: alumni_id -> existing save (for the ★ button state).
  const savedByAlumni = new Map<number, { status: typeof mySaves[number]["status"]; reason: typeof mySaves[number]["reason"]; note: string | null }>();
  for (const s of mySaves) {
    savedByAlumni.set(s.alumni_id, {
      status: s.status,
      reason: s.reason,
      note: s.note,
    });
  }
  const canSave = session?.kind === "user";

  return (
    <section className="max-w-[1180px] mx-auto px-5 sm:px-7 py-8">
      <div className="mb-6">
        <h1 className="font-sans text-[28px] sm:text-[34px] font-bold text-[color:var(--navy-ink)] tracking-[-0.01em]">
          {me?.first_name?.trim()
            ? `Welcome, ${me.first_name.trim()}`
            : "Directory"}
        </h1>
        <p className="text-sm text-[color:var(--muted)] mt-1.5 max-w-[68ch]">
          Search registered alumni and connect with them on LinkedIn.
        </p>
        <p className="text-sm text-[color:var(--muted)] max-w-[68ch]">
          Contact info is intentionally not shown — reach out via their
          LinkedIn profile.
        </p>
      </div>

      <form
        method="get"
        className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 sm:p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3"
      >
        {nl && <input type="hidden" name="nl" value="1" />}
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="flex items-center justify-between mb-1">
            <span className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
              {nl
                ? "🪄 Describe who you're looking for"
                : "🔎 Search (role, company, bio, past jobs, school…)"}
            </span>
            <DirectoryNLToggle on={nl} />
          </span>
          <input
            name="q"
            type="text"
            defaultValue={pickStr(sp, "q") ?? ""}
            placeholder={
              nl
                ? "e.g. designers in SF who used to work at Stripe"
                : "e.g. fintech, Stripe, designer"
            }
            className={fieldClass(!!filters.q)}
          />
          <label className="flex items-center gap-2 mt-2 text-xs text-[color:var(--muted)] cursor-pointer w-fit">
            <input
              type="checkbox"
              name="industriesIncludePast"
              value="1"
              defaultChecked={!!filters.industriesIncludePast}
            />
            <span>Include past roles when filtering by industry</span>
          </label>
        </label>

        {!nl && (
          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
              👤 Name (prefix match)
            </span>
            <input
              name="name"
              type="text"
              defaultValue={pickStr(sp, "name") ?? ""}
              placeholder={namePlaceholder}
              className={fieldClass(!!filters.name)}
            />
          </label>
        )}

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            🏫 College
          </span>
          <select
            name="college"
            defaultValue={filters.college ?? ""}
            className={fieldClass(!!filters.college)}
          >
            <option value="">Any</option>
            {COLLEGES.map((c) => (
              <option key={c.canonical} value={c.canonical}>
                {c.short}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            🌉 Region
          </span>
          <select
            name="region"
            defaultValue={filters.region ?? ""}
            className={fieldClass(!!filters.region)}
          >
            <option value="">Any</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            🎓 Grad year (from)
          </span>
          <input
            name="yearFrom"
            type="number"
            defaultValue={filters.yearFrom ?? ""}
            placeholder="e.g. 2010"
            className={fieldClass(filters.yearFrom != null)}
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            🎓 Grad year (to)
          </span>
          <input
            name="yearTo"
            type="number"
            defaultValue={filters.yearTo ?? ""}
            placeholder="e.g. 2020"
            className={fieldClass(filters.yearTo != null)}
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            💼 Industry
          </span>
          <select
            name="industry"
            defaultValue={filters.industry ?? ""}
            className={fieldClass(!!filters.industry)}
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

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            🏢 Company size
          </span>
          <select
            name="companySizeBand"
            defaultValue={filters.companySizeBand ?? ""}
            className={fieldClass(!!filters.companySizeBand)}
          >
            <option value="">Any</option>
            <option value="startup">Startup (1–50)</option>
            <option value="small">Small (51–500)</option>
            <option value="mid">Mid (501–5K)</option>
            <option value="large">Large (5K–50K)</option>
            <option value="enterprise">Enterprise (50K+)</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            ⏱️ Experience
          </span>
          <select
            name="expBand"
            defaultValue={filters.expBand ?? ""}
            className={fieldClass(!!filters.expBand)}
          >
            <option value="">Any</option>
            <option value="0-3">0–3 yrs (early)</option>
            <option value="3-7">3–7 yrs</option>
            <option value="7-15">7–15 yrs</option>
            <option value="15+">15+ yrs (senior)</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            🏙️ City contains
          </span>
          <input
            name="city"
            defaultValue={filters.city ?? ""}
            placeholder="e.g. San Francisco"
            className={fieldClass(!!filters.city)}
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            🌍 Origin contains
          </span>
          <input
            name="origin"
            defaultValue={filters.origin ?? ""}
            placeholder="e.g. Brazil"
            className={fieldClass(!!filters.origin)}
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            🏷️ Company contains
          </span>
          <input
            name="company"
            defaultValue={filters.company ?? ""}
            placeholder="e.g. Stripe"
            className={fieldClass(!!filters.company)}
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            🏛️ University contains
          </span>
          <input
            name="university"
            defaultValue={filters.university ?? ""}
            placeholder="e.g. Stanford"
            className={fieldClass(!!filters.university)}
          />
        </label>

        <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between">
          <span className="text-xs text-[color:var(--muted)]">
            {total} {total === 1 ? "alum" : "alumni"}
            {total > 500 && " (showing first 500)"}
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/directory"
              className="text-xs text-[color:var(--muted)] hover:text-navy"
            >
              Reset
            </Link>
            <button
              type="submit"
              className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold hover:opacity-90"
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
          <div className="mb-4 flex items-center flex-wrap gap-2 text-sm text-[color:var(--navy-ink)]">
            <span className="font-semibold">
              {total} {total === 1 ? "alum" : "alumni"} matching
            </span>
            {chips.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center bg-[color:var(--ivory-2)] border border-navy text-navy rounded-full px-2.5 py-0.5 text-xs font-medium"
              >
                {c.label}
              </span>
            ))}
          </div>
        );
      })()}

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => (
          <DirectoryCard
            key={r.id}
            row={r}
            canSave={canSave}
            initialSave={savedByAlumni.get(r.id) ?? null}
          />
        ))}
      </ul>

      {rows.length === 0 && (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
          No alumni match those filters.
        </div>
      )}
    </section>
  );
}

function DirectoryCard({
  row,
  canSave,
  initialSave,
}: {
  row: DirectoryAlumnusRow;
  canSave: boolean;
  initialSave: {
    status: SaveStatus;
    reason: SaveReason | null;
    note: string | null;
  } | null;
}) {
  const name =
    [row.first_name, row.last_name].filter(Boolean).join(" ") || "(no name)";
  const uwcLine = [row.uwc_college, row.grad_year]
    .filter(Boolean)
    .join(" · ");
  const flag = row.origin ? originFlagString(row.origin) : "";
  const countryLabel = row.origin
    ? originCountryNames(row.origin) ?? row.origin
    : "";
  const linkedin = linkedinHref(row.linkedin_url);
  const companyHref = linkedinHref(row.current_company_linkedin);

  const fullName =
    [row.first_name, row.last_name].filter(Boolean).join(" ") || "(no name)";

  return (
    <li className="relative bg-white border border-[color:var(--rule)] rounded-[10px] p-4 hover:border-navy">
      <SaveStar
        alumniId={row.id}
        alumName={fullName}
        initial={initialSave ? { ...initialSave } : null}
        canSave={canSave}
        className="absolute top-2 right-2"
      />
      <div className="flex gap-3">
        <Link
          href={`/directory/${row.id}`}
          className="block shrink-0 w-[64px] h-[64px] rounded-full overflow-hidden bg-[color:var(--ivory-2)]"
        >
          {row.photo_url ? (
            <Image
              src={row.photo_url}
              alt=""
              width={64}
              height={64}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[color:var(--muted)] text-xs">
              {name
                .split(" ")
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          {/* Line 1: name + LinkedIn icon */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/directory/${row.id}`}
              className="font-semibold text-[color:var(--navy-ink)] hover:underline"
            >
              {name}
            </Link>
            {linkedin ? (
              <a
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn profile"
                title="LinkedIn Profile"
                className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-[3px] bg-[#0A66C2] text-white text-[9px] font-bold hover:brightness-110 leading-none"
              >
                in
              </a>
            ) : (
              <span
                className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-[3px] bg-[color:var(--ivory-2)] text-[color:var(--muted)] text-[9px] font-bold leading-none"
                title="No LinkedIn on file"
                aria-label="No LinkedIn on file"
              >
                in
              </span>
            )}
          </div>

          {/* Line 2: UWC + year + flag */}
          {(uwcLine || flag) && (
            <div className="text-xs text-[color:var(--muted)] mt-0.5 flex items-center gap-1.5">
              {uwcLine && <span>{uwcLine}</span>}
              {flag && (
                <span
                  className="text-[16px] leading-none text-black"
                  style={{ fontVariantEmoji: "emoji" }}
                  title={countryLabel}
                  aria-label={`From ${countryLabel}`}
                >
                  {flag}
                </span>
              )}
            </div>
          )}

          {/* Line 3: current city, plus a 🧳 "moved" badge if their
              LinkedIn says they're outside the Bay Area now */}
          {(() => {
            const liveLoc = pickCurrentLocation({
              current_location: row.current_location,
              location_full: row.location_full,
            });
            const moved = detectMovedFromBayArea(liveLoc);
            if (!row.current_city && !moved) return null;
            return (
              <div className="text-xs text-[color:var(--muted)] mt-0.5">
                {row.current_city}
                {moved && (
                  <span
                    className="ml-1.5"
                    title="LinkedIn says they're not in the Bay Area anymore"
                  >
                    🧳 {moved}
                  </span>
                )}
              </div>
            );
          })()}

          {/* Lines 4 & 5: current role on one line, company on the next */}
          {(row.current_title || row.current_company) && (
            <div className="mt-1 text-xs text-[color:var(--navy-ink)]">
              {row.current_title && (
                <div
                  className="line-clamp-1"
                  title={row.current_title}
                >
                  {row.current_title}
                </div>
              )}
              {row.current_company && (
                <div
                  className="line-clamp-1 font-medium"
                  title={row.current_company}
                >
                  {companyHref ? (
                    <a
                      href={companyHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {row.current_company}
                    </a>
                  ) : (
                    row.current_company
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
