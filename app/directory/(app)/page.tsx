import Link from "next/link";
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
import SaveStar from "@/components/directory/SaveStar";
import { AlumGalleryCard, type AlumCardData } from "@/components/directory/AlumGalleryCard";
import DirectorySearch from "@/components/directory/DirectorySearch";
import { StatsCluster } from "@/components/directory/StatsCluster";
import { extractCountryCodes } from "@/lib/country-flag";
import {
  detectMovedFromBayArea,
  pickCurrentLocation,
} from "@/lib/location-moved";
import { displayName, titleCase } from "@/lib/text-format";
import { getFlagMap, getUwcLogoMap } from "@/lib/directory-lookups";
import {
  getDirectoryStats,
  getDirectorySuggestData,
} from "@/lib/directory-suggest";

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

  const scopeParam = pickStr(sp, "scope");
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
    scope: scopeParam === "ever" ? "ever" : "current",
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

  const { sql } = await import("@/lib/db");
  const [rows, total, mySaves, suggest, stats, currentUserName, grandTotal] =
    await Promise.all([
      searchDirectoryAlumni(filters, 500),
      countDirectoryAlumni(filters),
      userId ? listSavesForUser(userId) : Promise.resolve([]),
      getDirectorySuggestData(),
      getDirectoryStats(),
      currentUserAlumniId
        ? (sql`SELECT first_name, last_name FROM alumni WHERE id = ${currentUserAlumniId} LIMIT 1` as unknown as Promise<
            Array<{ first_name: string | null; last_name: string | null }>
          >)
        : Promise.resolve([] as Array<{ first_name: string | null; last_name: string | null }>),
      countDirectoryAlumni({}),
    ]);

  const me = currentUserName[0];
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
    <section className="max-w-[1200px] mx-auto px-5 sm:px-7 pt-1 pb-8 md:py-8">
      {/* Desktop welcome + stats. On mobile the layout's mobile
          header already shows the welcome + segmented nav, so this
          block stays out of the way (hidden md:flex). */}
      <div className="mb-6 hidden md:flex items-end md:items-center justify-between gap-5 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1
            className="display text-white font-extrabold leading-[1] tracking-[-0.02em] whitespace-nowrap"
            style={{ fontSize: "clamp(34px, 5.5vw, 54px)" }}
          >
            {me?.first_name?.trim()
              ? `Welcome, ${me.first_name.trim()}`
              : "Directory"}
          </h1>
          <p className="mt-[14px] text-[15px] sm:text-[17px] text-white/75">
            Search, and connect on LinkedIn.{" "}
            <Link
              href="/directory/snapshot"
              className="underline decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white"
            >
              Snapshot
            </Link>
            {" · "}
            <Link
              href="/directory/saved"
              className="underline decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white"
            >
              Shortlist
            </Link>
          </p>
        </div>
        <StatsCluster
          alumni={stats.alumni}
          countries={stats.countries}
          colleges={stats.colleges}
        />
      </div>

      <DirectorySearch
        filters={filters}
        initialNl={nl}
        total={total}
        grandTotal={grandTotal}
        suggest={suggest}
      />


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
    // Keep the full "UWC X" name on the cards — users prefer the
    // explicit prefix even though the surrounding directory makes UWC
    // implicit. The detail page still uses the wordmark logo, which
    // makes the text prefix redundant there.
    campus: row.uwc_college,
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
