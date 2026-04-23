import Link from "next/link";
import { COLLEGES } from "@/lib/uwc-colleges";
import { REGIONS } from "@/lib/region";
import { sql } from "@/lib/db";
import { searchAlumni, countAlumni, FOLLOWUP_REASONS, FOLLOWUP_REASON_LABELS, type AlumniFilters, type ExperienceBand } from "@/lib/alumni-query";
import { INDUSTRY_GROUPS, INDUSTRY_TO_GROUP, industriesInGroup, type IndustryGroup } from "@/lib/industry-groups";
import { VALID_SECTORS, SECTOR_LABELS } from "@/lib/company-classifier";
import { loadEngagement, scoreAlumni, splitEventResults, scoreAsPercent, type ScoredAlum, type DiversityDimension } from "@/lib/event-ranking";
import { parseEventQuery, parseSearchQuery, type ParsedEventQuery, type ParsedSearchQuery } from "@/lib/event-nl-parser";
import { runAiFilter, type CompanyMeta } from "@/lib/ai-filter";
import { findSearchMatches, type MatchInfo } from "@/lib/match-highlighter";
import YearFilter from "@/components/admin/YearFilter";
import { SelectAllCheckbox, SelectedCountLink } from "@/components/admin/AlumniSelection";
import { AlumniOptionsSection } from "@/components/admin/AlumniOptionsSection";
import { SearchNLToggle } from "@/components/admin/SearchNLToggle";
import { FilterFormWithLoading } from "@/components/admin/FilterFormWithLoading";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };

function pickStr(sp: SP, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}
function pickAll(sp: SP, key: string): string[] {
  const v = sp[key];
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}
function pickNum(sp: SP, key: string): number | undefined {
  const s = pickStr(sp, key);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

type IndustryOption = { value: string; count: number };
type CompanyOption = { name: string; id: string | null; count: number };

async function loadFilterOptions(): Promise<{ industries: IndustryOption[]; companies: CompanyOption[] }> {
  const [indRows, compRows] = await Promise.all([
    sql`
      SELECT current_company_industry AS value, COUNT(*)::int AS count
      FROM alumni
      WHERE current_company_industry IS NOT NULL
      GROUP BY current_company_industry
      ORDER BY count DESC, current_company_industry ASC
    `,
    sql`
      SELECT current_company AS name,
             MIN(current_company_id) AS id,
             COUNT(*)::int AS count
      FROM alumni
      WHERE current_company IS NOT NULL
      GROUP BY current_company
      ORDER BY count DESC, current_company ASC
    `,
  ]);
  return {
    industries: indRows as IndustryOption[],
    companies: compRows as CompanyOption[],
  };
}

export default async function AlumniPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  // Load industry + company option lists up-front so we can (a) populate the
  // form widgets and (b) resolve the typed-company string to its stable
  // current_company_id for accurate matching.
  const { industries, companies } = await loadFilterOptions();
  const companyIdMap: Record<string, string> = {};
  for (const c of companies) {
    if (c.id) companyIdMap[c.name.toLowerCase()] = c.id;
  }

  const filters: AlumniFilters = {
    q: pickStr(sp, "q"),
    college: pickStr(sp, "college"),
    region: pickStr(sp, "region"),
    origin: pickStr(sp, "origin"),
    city: pickStr(sp, "city"),
    yearFrom: pickNum(sp, "yearFrom"),
    yearTo: pickNum(sp, "yearTo"),
    help: pickStr(sp, "help"),
    includeNonAlums: pickStr(sp, "includeNonAlums") === "1",
    includeMovedOut: pickStr(sp, "includeMovedOut") === "1",
    // Subscription / engagement removed from UI but kept as filter-API defaults
    // so the send pipeline (which reuses this filter shape) still excludes
    // unsubscribed alumni by default.
    subscription: "any",
    industryGroup: (pickStr(sp, "industryGroup") as IndustryGroup | undefined) || undefined,
    company: pickStr(sp, "company"),
    university: pickStr(sp, "university"),
    companyTag: pickStr(sp, "companyTag") as AlumniFilters["companyTag"],
    sector: pickStr(sp, "sector"),
    gender: pickStr(sp, "gender") as AlumniFilters["gender"],
    companyIdMap,
    expBand: pickStr(sp, "expBand") as ExperienceBand | undefined,
    uwcVerified: pickStr(sp, "uwcVerified") as AlumniFilters["uwcVerified"],
    hasPhoto: pickStr(sp, "hasPhoto") === "1",
    linkedin: pickStr(sp, "linkedin") as AlumniFilters["linkedin"],
    followup: pickStr(sp, "followup") as AlumniFilters["followup"],
    engagement: pickStr(sp, "engagement") as AlumniFilters["engagement"],
  };

  const showPhotos = pickStr(sp, "showPhotos") === "1";
  const aiFilter = pickStr(sp, "aiFilter") || null;
  const searchNL = pickStr(sp, "searchNL") === "1";
  const applied = pickStr(sp, "applied") === "1";
  const eventMode = !searchNL && pickStr(sp, "eventMode") === "1";
  // NL mode never runs until the user clicks Apply filters — toggling
  // mode just flips the UI, search waits for explicit submission.
  const nlReady = searchNL && applied && !!filters.q;
  const rankByEngagementWidget = pickStr(sp, "rankByEngagement") === "1";
  const rankByDiversityWidget = pickStr(sp, "rankByDiversity") === "1";
  const rankByRecencyWidget = pickStr(sp, "rankByRecency") === "1";
  let eventSize = Math.max(1, Math.min(100, pickNum(sp, "eventSize") ?? 20));
  const addToList = pickStr(sp, "addToList") || null;
  let addToListName: string | null = null;
  if (addToList) {
    const { getInviteList } = await import("@/lib/invite-lists");
    const list = await getInviteList(addToList);
    addToListName = list?.name ?? null;
  }

  // Phase 3: when event mode is on and the search box has text, run the NL
  // parser to auto-configure filters + ranking + diversity dims. Falls back
  // transparently to fuzzy search on parse failure.
  let parsed: ParsedEventQuery | null = null;
  let parseError: string | null = null;
  if (eventMode && filters.q) {
    const result = await parseEventQuery(filters.q);
    if (result.ok) parsed = result.parsed;
    else parseError = result.error;
  }

  // Phase 3.5: Natural-language search mode — simpler parser, no event
  // scoring. When on, widget filters are ignored; we use only what the
  // parser extracts plus the options-section checkboxes (photo, etc.).
  let searchParsed: ParsedSearchQuery | null = null;
  let searchParseError: string | null = null;
  if (nlReady) {
    const result = await parseSearchQuery(filters.q!);
    if (result.ok) searchParsed = result.parsed;
    else searchParseError = result.error;
  }
  if (nlReady && searchParsed) {
    const widgetSafe: AlumniFilters = {
      // Keep only options-section flags from the widgets; wipe every
      // structured filter so parser output is authoritative.
      companyIdMap,
      subscription: "any",
      includeNonAlums: filters.includeNonAlums,
      includeMovedOut: filters.includeMovedOut,
      hasPhoto: filters.hasPhoto,
    };
    if (searchParsed.industryGroups.length > 0) {
      const expanded = searchParsed.industryGroups.flatMap((g) => industriesInGroup(g));
      widgetSafe.industries = Array.from(new Set(expanded));
      // Only widen to past roles when the phrasing asks for it
      // (e.g. "consulting experience", "ex-consultants", "tech background").
      widgetSafe.industriesIncludePast = searchParsed.industryScope === "past_or_current";
    }
    if (searchParsed.city) widgetSafe.city = searchParsed.city;
    if (searchParsed.region) widgetSafe.region = searchParsed.region;
    if (searchParsed.minGradYear != null) widgetSafe.yearFrom = searchParsed.minGradYear;
    if (searchParsed.maxGradYear != null) widgetSafe.yearTo = searchParsed.maxGradYear;
    if (searchParsed.companyName) widgetSafe.company = searchParsed.companyName;
    if (searchParsed.companySizeBand) widgetSafe.companySizeBand = searchParsed.companySizeBand;
    if (searchParsed.college) widgetSafe.college = searchParsed.college;
    if (searchParsed.university) widgetSafe.university = searchParsed.university;
    if (searchParsed.origin) widgetSafe.origin = searchParsed.origin;
    if (searchParsed.companyTag) widgetSafe.companyTag = searchParsed.companyTag;
    // Belt-and-suspenders: if both industries and sector were emitted, drop
    // sector. LinkedIn industry tags have much wider coverage than our
    // classification table, and AND'ing both usually produces zero rows.
    if (searchParsed.sector && !widgetSafe.industries) {
      widgetSafe.sector = searchParsed.sector;
    }
    if (searchParsed.gender) widgetSafe.gender = searchParsed.gender;
    widgetSafe.q = searchParsed.keywords.length > 0 ? searchParsed.keywords.join(" ") : undefined;
    // Replace the filters object entirely.
    Object.assign(filters, {
      // wipe everything first
      q: undefined,
      college: undefined,
      region: undefined,
      origin: undefined,
      city: undefined,
      yearFrom: undefined,
      yearTo: undefined,
      help: undefined,
      industryGroup: undefined,
      industries: undefined,
      industriesIncludePast: undefined,
      company: undefined,
      university: undefined,
      companySizeBand: undefined,
      companyTag: undefined,
      sector: undefined,
      gender: undefined,
      expBand: undefined,
      uwcVerified: undefined,
      linkedin: undefined,
      followup: undefined,
      engagement: undefined,
    });
    Object.assign(filters, widgetSafe);
  }

  // Apply parser output on top of widget-driven filters (parser wins per field).
  if (parsed) {
    // Industry groups → expand each to its constituent LinkedIn industries
    // and merge into `industries` (any-of match).
    if (parsed.industryGroups.length > 0) {
      const expanded = parsed.industryGroups.flatMap((g) => industriesInGroup(g));
      filters.industries = Array.from(new Set(expanded));
      filters.industryGroup = undefined;
    }
    if (parsed.city) filters.city = parsed.city;
    if (parsed.region) filters.region = parsed.region;
    if (parsed.minGradYear != null) filters.yearFrom = parsed.minGradYear;
    if (parsed.maxGradYear != null) filters.yearTo = parsed.maxGradYear;
    if (parsed.companyName) filters.company = parsed.companyName;
    if (parsed.companySizeBand) filters.companySizeBand = parsed.companySizeBand;
    // Replace the NL query with only parser-extracted keywords (if any).
    // Leaving the raw NL query would ILIKE-match literal phrases like
    // "tech dinner, 20 people" against bio/title — matches nothing.
    filters.q = parsed.keywords.length > 0 ? parsed.keywords.join(" ") : undefined;
    eventSize = parsed.eventSize;
  }

  // Effective scoring options: parser wins, else widget toggle.
  const rankByEngagement = parsed ? parsed.rankByEngagement : rankByEngagementWidget;
  const rankByRecency = parsed ? parsed.rankByRecency : rankByRecencyWidget;
  const diversityDimensions: DiversityDimension[] = parsed
    ? parsed.diversityDimensions
    : rankByDiversityWidget
      ? ["origin", "school", "region", "company", "age"]
      : [];

  // NL mode without an applied query shouldn't run any search — skip
  // the DB round-trip so the UI stays empty until Apply is clicked.
  const nlWaiting = searchNL && !nlReady;
  const [rawRows, total] = nlWaiting
    ? [[] as Awaited<ReturnType<typeof searchAlumni>>, 0]
    : await Promise.all([searchAlumni(filters, 500), countAlumni(filters)]);

  // Runtime AI filter: after SQL narrowing, ask Claude once whether each
  // unique company matches the user's free-text criterion. Used for
  // semantic questions that aren't covered by stored classifications
  // (e.g. "B corps", "companies building climate tech").
  let rows = rawRows;
  let aiFilterError: string | null = null;
  let aiMatchedCount: number | null = null;
  if (aiFilter && rawRows.length > 0) {
    // Pull sector labels (if classified) to give Claude more signal.
    const companyKeys = Array.from(
      new Set(
        rawRows
          .map((r) => (r.current_company ?? "").trim().toLowerCase())
          .filter((k) => k)
      )
    );
    const sectorRows = (await sql`
      SELECT company_key, sector FROM company_classifications WHERE company_key = ANY(${companyKeys})
    `) as { company_key: string; sector: string | null }[];
    const sectorByKey = new Map<string, string | null>();
    for (const s of sectorRows) sectorByKey.set(s.company_key, s.sector);

    const seen = new Set<string>();
    const companyList: CompanyMeta[] = [];
    for (const r of rawRows) {
      const key = (r.current_company ?? "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      companyList.push({
        key,
        name: r.current_company ?? key,
        industry: r.current_company_industry,
        sector: sectorByKey.get(key) ?? null,
      });
    }
    const result = await runAiFilter(aiFilter, companyList);
    if (result.ok) {
      rows = rawRows.filter((r) => {
        const key = (r.current_company ?? "").trim().toLowerCase();
        return key && result.matches.has(key);
      });
      aiMatchedCount = result.matches.size;
    } else {
      aiFilterError = result.error;
    }
  }

  let scored: ScoredAlum[] = [];
  let topRanked: ScoredAlum[] = [];
  let honorable: ScoredAlum[] = [];
  if (eventMode) {
    const engagement = rankByEngagement
      ? await loadEngagement(rows.map((r) => r.id))
      : new Map();
    scored = scoreAlumni(rows, { rankByEngagement, rankByRecency, diversityDimensions }, engagement);
    const split = splitEventResults(scored, eventSize);
    topRanked = split.top;
    honorable = split.honorable;
  }

  // When the user typed a free-text query, surface a "why it matched"
  // line for rows whose match came from a field not already shown in the
  // results table (past roles, undergrad, bio, headline, etc.).
  const matchRows = eventMode ? topRanked : rows;
  const searchMatches =
    filters.q && matchRows.length > 0
      ? await findSearchMatches(matchRows, filters.q)
      : (new Map() as Map<number, MatchInfo>);

  // Preserve the raw URL params so detail-page "Back to alumni" can return
  // the user to the same filtered list (NL query, event mode, etc. intact).
  const rawListQs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v !== "") rawListQs.set(k, v);
    else if (Array.isArray(v)) for (const vv of v) if (typeof vv === "string" && vv) rawListQs.append(k, vv);
  }
  const listFromParam = rawListQs.toString();
  const detailHref = (id: number) =>
    `/admin/alumni/${id}${listFromParam ? `?from=${encodeURIComponent(listFromParam)}` : ""}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Alumni lookup</h1>
        <p className="text-[color:var(--muted)] text-sm">
          {aiFilter && aiMatchedCount != null ? (
            <>
              {rows.length.toLocaleString()} {rows.length === 1 ? "match" : "matches"}
              <span className="text-[color:var(--muted)]">{" "}· AI-filtered from {rawRows.length.toLocaleString()}</span>
            </>
          ) : (
            <>
              {total.toLocaleString()} {total === 1 ? "match" : "matches"}
              {rows.length < total ? ` · showing first ${rows.length}` : ""}
            </>
          )}
        </p>
      </div>
      {addToList && addToListName && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm flex items-center justify-between">
          <span>
            Adding selections to invite list:{" "}
            <Link href={`/admin/events/${addToList}`} className="font-semibold text-navy hover:underline">
              {addToListName}
            </Link>
          </span>
          <Link href="/admin/alumni" className="text-xs text-[color:var(--muted)] hover:text-navy">
            Cancel
          </Link>
        </div>
      )}

      {eventMode && parsed && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1.5">What I understood</div>
          <div className="flex flex-wrap gap-1.5">
            <ParseChip label={`Event size: ${parsed.eventSize}`} />
            {parsed.industryGroups.map((g) => (
              <ParseChip key={g} label={g} />
            ))}
            {parsed.city && <ParseChip label={`City: ${parsed.city}`} />}
            {parsed.region && <ParseChip label={`Region: ${parsed.region}`} />}
            {parsed.international && <ParseChip label="International" />}
            {parsed.minGradYear != null && <ParseChip label={`Grad ≥ ${parsed.minGradYear}`} />}
            {parsed.maxGradYear != null && <ParseChip label={`Grad ≤ ${parsed.maxGradYear}`} />}
            {parsed.companyName && <ParseChip label={`Company: ${parsed.companyName}`} />}
            {parsed.companySizeBand && <ParseChip label={`Size: ${parsed.companySizeBand}`} />}
            {parsed.keywords.length > 0 && <ParseChip label={`Keywords: ${parsed.keywords.join(", ")}`} />}
            {parsed.diversityDimensions.length > 0 && (
              <ParseChip label={`Diversity: ${parsed.diversityDimensions.join(", ")}`} tone="diversity" />
            )}
            {parsed.rankByEngagement && <ParseChip label="Engagement ranking" tone="rank" />}
            {parsed.rankByRecency && <ParseChip label="Recency ranking" tone="rank" />}
          </div>
        </div>
      )}
      {eventMode && parseError && filters.q && (
        <div className="mb-5 p-3 bg-orange-50 border-l-4 border-orange-400 rounded-[2px] text-sm">
          <span className="font-semibold text-orange-800">Couldn&rsquo;t parse the query</span>
          <span className="text-orange-800"> — falling back to fuzzy keyword search. ({parseError})</span>
        </div>
      )}

      {searchNL && searchParsed && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1.5">What I understood</div>
          <div className="flex flex-wrap gap-1.5">
            {searchParsed.industryGroups.map((g) => (
              <ParseChip
                key={g}
                label={
                  searchParsed.industryScope === "past_or_current"
                    ? `${g} (any time)`
                    : g
                }
              />
            ))}
            {searchParsed.city && <ParseChip label={`City: ${searchParsed.city}`} />}
            {searchParsed.region && <ParseChip label={`Region: ${searchParsed.region}`} />}
            {searchParsed.minGradYear != null && <ParseChip label={`Grad ≥ ${searchParsed.minGradYear}`} />}
            {searchParsed.maxGradYear != null && <ParseChip label={`Grad ≤ ${searchParsed.maxGradYear}`} />}
            {searchParsed.companyName && <ParseChip label={`Company: ${searchParsed.companyName}`} />}
            {searchParsed.companySizeBand && <ParseChip label={`Size: ${searchParsed.companySizeBand}`} />}
            {searchParsed.college && <ParseChip label={`UWC: ${searchParsed.college}`} />}
            {searchParsed.university && <ParseChip label={`University: ${searchParsed.university}`} />}
            {searchParsed.origin && <ParseChip label={`Origin: ${searchParsed.origin}`} />}
            {searchParsed.companyTag && (
              <ParseChip
                label={
                  searchParsed.companyTag === "tech"
                    ? "Tech companies"
                    : searchParsed.companyTag === "non_tech"
                      ? "Non-tech companies"
                      : searchParsed.companyTag === "startup"
                        ? "Startups"
                        : "Not startups"
                }
                tone="diversity"
              />
            )}
            {searchParsed.gender && (
              <ParseChip
                label={
                  searchParsed.gender === "female"
                    ? "Women"
                    : searchParsed.gender === "male"
                      ? "Men"
                      : "They/them"
                }
                tone="diversity"
              />
            )}
            {searchParsed.keywords.length > 0 && <ParseChip label={`Keywords: ${searchParsed.keywords.join(", ")}`} />}
          </div>
        </div>
      )}
      {searchNL && searchParseError && filters.q && (
        <div className="mb-5 p-3 bg-orange-50 border-l-4 border-orange-400 rounded-[2px] text-sm">
          <span className="font-semibold text-orange-800">Couldn&rsquo;t parse the query</span>
          <span className="text-orange-800"> — falling back to fuzzy keyword search. ({searchParseError})</span>
        </div>
      )}

      {aiFilter && aiMatchedCount != null && (
        <div className="mb-5 p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-[2px] text-sm">
          <span className="font-semibold text-emerald-900">AI filter applied:</span>{" "}
          <span className="text-emerald-900">&ldquo;{aiFilter}&rdquo;</span>
          <span className="text-emerald-900/80">
            {" · "}{aiMatchedCount} {aiMatchedCount === 1 ? "company" : "companies"} matched
            {" · "}narrowed from {rawRows.length} to {rows.length} {rows.length === 1 ? "alum" : "alumni"}
          </span>
        </div>
      )}
      {aiFilter && aiFilterError && (
        <div className="mb-5 p-3 bg-orange-50 border-l-4 border-orange-400 rounded-[2px] text-sm">
          <span className="font-semibold text-orange-800">AI filter failed</span>
          <span className="text-orange-800"> — showing unfiltered results. ({aiFilterError})</span>
        </div>
      )}

      <FilterFormWithLoading
        formKey={JSON.stringify({ ...filters, eventMode, rankByEngagement, rankByDiversityWidget, rankByRecency, eventSize })}
        className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Marks this request as an explicit Apply (vs. a mode-toggle
            navigation). NL mode only runs search when applied=1. */}
        <input type="hidden" name="applied" value="1" />
        {/* Carry the current mode through form submission — FormData
            builds a fresh URL, so mode params would otherwise be
            dropped on Apply. */}
        {searchNL && <input type="hidden" name="searchNL" value="1" />}
        {eventMode && <input type="hidden" name="eventMode" value="1" />}
        {/* Row 1 — full-width free-text search + inline NL toggle */}
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="flex items-center justify-between mb-1">
            <span className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
              {eventMode
                ? "Describe your event (natural language)"
                : searchNL
                  ? "Describe who you're looking for (natural language)"
                  : "Search (name, city, bio, work…)"}
            </span>
            {!eventMode && <SearchNLToggle on={searchNL} />}
          </span>
          <input
            name="q"
            type="text"
            defaultValue={pickStr(sp, "q") ?? ""}
            placeholder={
              eventMode
                ? "e.g. Tech dinner, 20 people, good mix of origins and ages, high engagement"
                : searchNL
                  ? "e.g. tech people in SF who graduated after 2015, working at startups"
                  : "e.g. finance"
            }
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>

        {!searchNL && <>
        {/* Row 2 — college / region / year / industry */}
        <Select label="College" name="college" defaultValue={filters.college}>
          <option value="">Any</option>
          {COLLEGES.map((c) => (
            <option key={c.canonical} value={c.canonical}>
              {c.short}
            </option>
          ))}
        </Select>
        <Select label="Region" name="region" defaultValue={filters.region}>
          <option value="">Any</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <YearFilter initialFrom={filters.yearFrom} initialTo={filters.yearTo} />
        <IndustryGroupSelect
          industryCounts={industries}
          selected={filters.industryGroup}
        />

        {/* Row 3 — origin / city / current company / experience + university */}
        <Field label="Origin contains" name="origin" defaultValue={filters.origin} placeholder="e.g. Brazil" />
        <Field label="City contains" name="city" defaultValue={filters.city} placeholder="e.g. San Francisco" />
        <CompanyField options={companies} value={filters.company} />
        <Field label="University contains" name="university" defaultValue={filters.university} placeholder="e.g. Stanford" />
        <Select label="Experience" name="expBand" defaultValue={filters.expBand ?? ""}>
          <option value="">Any</option>
          <option value="0-3">0–3 years</option>
          <option value="3-7">3–7 years</option>
          <option value="7-15">7–15 years</option>
          <option value="15+">15+ years</option>
        </Select>

        {/* Row 4 — help tag / uwc verified / has photo */}
        <Field label="Help tag contains" name="help" defaultValue={filters.help} placeholder="e.g. events" />
        <Select label="UWC verified" name="uwcVerified" defaultValue={filters.uwcVerified ?? ""}>
          <option value="">Any</option>
          <option value="verified">Verified only</option>
          <option value="unverified">Unverified only</option>
        </Select>
        <Select label="LinkedIn" name="linkedin" defaultValue={filters.linkedin ?? ""}>
          <option value="">Any</option>
          <option value="has">Has LinkedIn URL</option>
          <option value="missing">No LinkedIn URL (all)</option>
          <option value="missing_unverified">No LinkedIn — not yet checked</option>
          <option value="missing_confirmed">No LinkedIn — confirmed unavailable</option>
        </Select>
        <Select label="Follow-up" name="followup" defaultValue={filters.followup ?? ""}>
          <option value="">Any</option>
          <option value="any">Needs follow-up (any reason)</option>
          {FOLLOWUP_REASONS.map((v) => (
            <option key={v} value={v}>
              {FOLLOWUP_REASON_LABELS[v]}
            </option>
          ))}
          <option value="none">No follow-up needed</option>
        </Select>
        <Select label="Email engagement" name="engagement" defaultValue={filters.engagement ?? ""}>
          <option value="">Any</option>
          <option value="opened_any">Opened any email</option>
          <option value="clicked_any">Clicked any link</option>
          <option value="never_opened">Received, never opened</option>
          <option value="never_received">Never received an email</option>
        </Select>
        <Select label="Company type" name="companyTag" defaultValue={filters.companyTag ?? ""}>
          <option value="">Any</option>
          <option value="tech">Tech company</option>
          <option value="non_tech">Non-tech</option>
          <option value="startup">Startup</option>
          <option value="not_startup">Not a startup</option>
        </Select>
        <Select label="Sector" name="sector" defaultValue={filters.sector ?? ""}>
          <option value="">Any</option>
          {VALID_SECTORS.map((s) => (
            <option key={s} value={s}>{SECTOR_LABELS[s]}</option>
          ))}
        </Select>
        <Select label="Gender" name="gender" defaultValue={filters.gender ?? ""}>
          <option value="">Any</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="they">They</option>
          <option value="unknown">Unknown</option>
          <option value="unset">Not classified yet</option>
        </Select>
        </>}

        {/* Runtime AI filter — asks Claude per-company at query time, so this
            one adds 2-3s to Apply. Use for long-tail semantic questions that
            stored classifications don't cover. */}
        <Field
          label="Ask AI about companies (optional, adds ~3s)"
          name="aiFilter"
          defaultValue={aiFilter ?? undefined}
          placeholder="e.g. B corps, companies building climate tech, minority-led firms"
          span="sm:col-span-2 lg:col-span-4"
        />

        {/* Options — grouped checkboxes (client component: Event ranking reveals on-click) */}
        <AlumniOptionsSection
          hasPhoto={!!filters.hasPhoto}
          showPhotos={showPhotos}
          includeNonAlums={!!filters.includeNonAlums}
          includeMovedOut={!!filters.includeMovedOut}
          eventMode={eventMode}
          searchNL={searchNL}
          rankByEngagement={rankByEngagementWidget}
          rankByDiversity={rankByDiversityWidget}
          rankByRecency={rankByRecencyWidget}
          eventSize={eventSize}
        />

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold"
          >
            Apply filters
          </button>
          <Link href="/admin/alumni" className="px-5 py-2.5 text-sm text-[color:var(--muted)] hover:text-navy">
            Clear
          </Link>
        </div>
      </FilterFormWithLoading>

      {nlWaiting && (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-8 text-center">
          <p className="font-sans font-semibold text-[color:var(--navy-ink)] mb-1">
            Natural-language search
          </p>
          <p className="text-sm text-[color:var(--muted)]">
            Describe who you&rsquo;re looking for above, then click <span className="font-semibold text-navy">Apply filters</span> to run the search.
          </p>
        </div>
      )}

      {!nlWaiting && <>
      <div className="flex items-center justify-between mb-3 text-sm">
        <p className="font-sans font-semibold text-[color:var(--navy-ink)]">
          {aiFilter && aiMatchedCount != null ? (
            <>
              {rows.length.toLocaleString()} {rows.length === 1 ? "match" : "matches"}
              <span className="font-normal text-[color:var(--muted)]">{" "}· AI-filtered from {rawRows.length.toLocaleString()}</span>
            </>
          ) : (
            <>
              {total.toLocaleString()} {total === 1 ? "match" : "matches"}
              {eventMode ? (
                <span className="font-normal text-[color:var(--muted)]">
                  {" · ranking top "}{topRanked.length}
                  {honorable.length > 0 ? ` · ${honorable.length} honorable mentions` : ""}
                </span>
              ) : rows.length < total ? (
                <span className="font-normal text-[color:var(--muted)]"> · showing first {rows.length}</span>
              ) : null}
            </>
          )}
        </p>
        <div className="flex items-center gap-4">
          {addToList && addToListName ? (
            <SelectedCountLink
              formId="alumni-select-form"
              label={`Add to ${addToListName}`}
              formAction={`/admin/events/${addToList}/add`}
            />
          ) : (
            <SelectedCountLink
              formId="alumni-select-form"
              label="Save as invite list"
              formAction="/admin/events/new"
            />
          )}
          <SelectedCountLink formId="alumni-select-form" label="Email selected" />
        </div>
      </div>

      <form id="alumni-select-form" method="GET" action="/admin/email/campaigns/new">
        {eventMode && (
          <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
                <tr>
                  <Th><SelectAllCheckbox formId="alumni-select-form" /></Th>
                  <Th className="w-[240px]">Name</Th>
                  <Th className="w-[260px]">Role</Th>
                  <Th className="w-[80px]">Score</Th>
                  <Th>Why they fit</Th>
                </tr>
              </thead>
              <tbody>
                {topRanked.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[color:var(--muted)]">
                      No candidates match these filters. Loosen something up top.
                    </td>
                  </tr>
                )}
                {topRanked.map((r) => (
                  <tr key={r.id} className="border-t border-[color:var(--rule)] hover:bg-ivory align-top">
                    <Td>
                      <input
                        type="checkbox"
                        name="ids"
                        value={r.id}
                        aria-label={`Select ${[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}`}
                      />
                    </Td>
                    <Td>
                      <div className="flex items-start gap-2.5">
                        {showPhotos && <Thumb url={r.photo_url} firstName={r.first_name} email={r.email} size={40} />}
                        <div className="flex-1 min-w-0">
                          <Link href={detailHref(r.id)} className="font-semibold text-navy hover:underline block">
                            {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}
                          </Link>
                          <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                            {r.uwc_college ?? "—"}
                            {r.grad_year ? ` · ${r.grad_year}` : ""}
                            {r.location_city ? ` · ${r.location_city}` : ""}
                          </div>
                          <MatchLine info={searchMatches.get(r.id)} />
                          <div className="mt-1 flex items-center gap-1.5">
                            {r.linkedin_url && (
                              <a
                                href={r.linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="LinkedIn profile"
                                className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm bg-[#0A66C2] text-white text-[10px] font-bold hover:brightness-110"
                              >
                                in
                              </a>
                            )}
                            <QuickLinks email={r.email} mobile={r.mobile} />
                            {r.followup_reason && (
                              <span
                                title={`Needs follow-up — ${followupLabel(r.followup_reason)}`}
                                className="ml-1 text-orange-700 text-base leading-none"
                              >
                                ⚑
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="block max-w-[260px] break-words leading-snug">
                        {r.current_title || <span className="text-[color:var(--muted)]">—</span>}
                        {r.current_company ? (
                          <span className="block text-xs text-[color:var(--muted)]">@ {r.current_company}</span>
                        ) : null}
                      </span>
                    </Td>
                    <Td>
                      <span
                        title={`Raw score: ${r.score}`}
                        className="inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded bg-ivory-2 border border-[color:var(--rule)] text-sm font-semibold text-navy"
                      >
                        {scoreAsPercent(r.score)}
                      </span>
                    </Td>
                    <Td>
                      {r.reasons.length > 0 ? (
                        <span className="text-xs text-[color:var(--navy-ink)]">
                          {r.reasons.join(", ")}
                        </span>
                      ) : (
                        <span className="text-[color:var(--muted)]">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!eventMode && (
          <>
        {/* ── Desktop: table view (md and up) ────────────────────────────── */}
        <div className="hidden md:block bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <Th>
                  <SelectAllCheckbox formId="alumni-select-form" />
                </Th>
                <Th className="w-[240px]">Name</Th>
                <Th className="w-[140px]">College</Th>
                <Th className="w-[70px]">Year</Th>
                <Th className="w-[120px]">Origin</Th>
                <Th className="w-[140px]">City</Th>
                <Th>Current title</Th>
                <Th>Current company</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[color:var(--muted)]">
                    No matches.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--rule)] hover:bg-ivory">
                  <Td>
                    <input
                      type="checkbox"
                      name="ids"
                      value={r.id}
                      aria-label={`Select ${[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}`}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-start gap-2.5">
                      {showPhotos && <Thumb url={r.photo_url} firstName={r.first_name} email={r.email} size={40} />}
                      <div className="flex-1 min-w-0">
                    <Link
                      href={detailHref(r.id)}
                      className="font-semibold text-navy hover:underline block"
                    >
                      {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}
                    </Link>
                    <MatchLine info={searchMatches.get(r.id)} />
                    <div className="mt-1 flex items-center gap-1.5">
                      {r.linkedin_url && (
                        <a
                          href={r.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="LinkedIn profile"
                          title="Open LinkedIn profile"
                          className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm bg-[#0A66C2] text-white text-[10px] font-bold hover:brightness-110"
                        >
                          in
                        </a>
                      )}
                      <QuickLinks email={r.email} mobile={r.mobile} />
                      {r.affiliation && r.affiliation !== "Alum" && (
                        <span className="ml-1 text-[10px] text-[color:var(--muted)] uppercase tracking-wider">
                          {r.affiliation}
                        </span>
                      )}
                      {r.flags?.length > 0 && (
                        <span className="ml-1 text-[10px] text-orange-700 uppercase tracking-wider">
                          {r.flags.join(", ")}
                        </span>
                      )}
                      {r.followup_reason && (
                        <span
                          title={`Needs follow-up — ${followupLabel(r.followup_reason)}`}
                          aria-label={`Needs follow-up — ${followupLabel(r.followup_reason)}`}
                          className="ml-1 text-orange-700 text-base leading-none"
                        >
                          ⚑
                        </span>
                      )}
                    </div>
                      </div>
                    </div>
                  </Td>
                  <Td>{r.uwc_college ?? <span className="text-[color:var(--muted)]">—</span>}</Td>
                  <Td>{r.grad_year ?? <span className="text-[color:var(--muted)]">—</span>}</Td>
                  <Td>{r.origin ?? "—"}</Td>
                  <Td>{r.current_city ?? <span className="text-[color:var(--muted)]">—</span>}</Td>
                  <Td>
                    {r.current_title ? (
                      <span className="block max-w-[240px] break-words leading-snug">
                        {r.current_title}
                      </span>
                    ) : (
                      <span className="text-[color:var(--muted)]">—</span>
                    )}
                  </Td>
                  <Td>
                    {r.current_company ? (
                      <span className="block max-w-[180px] break-words leading-snug">
                        {r.current_company}
                      </span>
                    ) : (
                      <span className="text-[color:var(--muted)]">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Mobile: stacked cards (below md) ───────────────────────────── */}
        <div className="md:hidden space-y-3">
          {rows.length === 0 && (
            <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 text-center text-sm text-[color:var(--muted)]">
              No matches.
            </div>
          )}
          {rows.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-[color:var(--muted)] px-1">
              <SelectAllCheckbox formId="alumni-select-form" />
              Select all on this page
            </label>
          )}
          {rows.map((r) => {
            const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;
            return (
              <div
                key={r.id}
                className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 flex gap-3 text-sm overflow-hidden"
              >
                <input
                  type="checkbox"
                  name="ids"
                  value={r.id}
                  aria-label={`Select ${fullName}`}
                  className="mt-1 shrink-0 w-4 h-4"
                />
                {showPhotos && <Thumb url={r.photo_url} firstName={r.first_name} email={r.email} size={44} />}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                    <Link
                      href={detailHref(r.id)}
                      className="font-semibold text-navy hover:underline"
                    >
                      {fullName}
                    </Link>
                    {r.linkedin_url && (
                      <a
                        href={r.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="LinkedIn profile"
                        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm bg-[#0A66C2] text-white text-[10px] font-bold leading-none"
                      >
                        in
                      </a>
                    )}
                    <QuickLinks email={r.email} mobile={r.mobile} />
                    {r.affiliation && r.affiliation !== "Alum" && (
                      <span className="text-[10px] text-[color:var(--muted)] uppercase tracking-wider">
                        {r.affiliation}
                      </span>
                    )}
                    {r.flags?.length > 0 && (
                      <span className="text-[10px] text-orange-700 uppercase tracking-wider">
                        {r.flags.join(", ")}
                      </span>
                    )}
                    {r.followup_reason && (
                      <span
                        title={`Needs follow-up — ${followupLabel(r.followup_reason)}`}
                        aria-label={`Needs follow-up — ${followupLabel(r.followup_reason)}`}
                        className="text-orange-700 text-base leading-none"
                      >
                        ⚑
                      </span>
                    )}
                  </div>
                  {r.headline && (
                    <div className="text-xs italic text-[color:var(--muted)] mb-1 line-clamp-2">
                      {r.headline}
                    </div>
                  )}
                  <MatchLine info={searchMatches.get(r.id)} />
                  <MetaLine
                    pairs={[
                      ["College", r.uwc_college],
                      ["Year", r.grad_year ?? undefined],
                    ]}
                  />
                  <MetaLine
                    pairs={[
                      ["Current", r.current_title && r.current_company
                        ? `${r.current_title} @ ${r.current_company}`
                        : r.current_title || r.current_company || undefined],
                    ]}
                  />
                  <MetaLine
                    pairs={[
                      ["Origin", r.origin],
                      ["City", r.current_city],
                      ["Region", r.region],
                    ]}
                  />
                  <div className="mt-1.5">
                    <a
                      href={`mailto:${r.email}`}
                      className="text-navy hover:underline break-all text-xs"
                    >
                      {r.email}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          </>
        )}
      </form>

      {eventMode && honorable.length > 0 && (
        <section className="mt-6 bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
          <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
            Honorable mentions <span className="text-[color:var(--muted)] font-normal normal-case tracking-normal">— close to making the cut</span>
          </h2>
          <ul className="space-y-2">
            {honorable.map((r) => {
              const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;
              const role = [r.current_title, r.current_company].filter(Boolean).join(" @ ");
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      title={`Raw score: ${r.score}`}
                      className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 rounded bg-ivory-2 border border-[color:var(--rule)] text-xs font-semibold text-navy shrink-0"
                    >
                      {scoreAsPercent(r.score)}
                    </span>
                    <Link href={detailHref(r.id)} className="font-semibold text-navy hover:underline truncate">
                      {name}
                    </Link>
                    <span className="text-xs text-[color:var(--muted)] truncate">{role || "—"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      </>}
    </div>
  );
}

function Field({ label, name, defaultValue, placeholder, type = "text", span = "" }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; type?: string; span?: string;
}) {
  return (
    <label className={`block ${span}`}>
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function Select({ label, name, defaultValue, children }: {
  label: string; name: string; defaultValue?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      >
        {children}
      </select>
    </label>
  );
}

function followupLabel(reason: string): string {
  return (FOLLOWUP_REASON_LABELS as Record<string, string>)[reason] ?? reason;
}

/**
 * Turn a stored phone number into a wa.me URL. wa.me only accepts digits —
 * no +, dashes, spaces, or parens. Returns null if there aren't enough
 * digits to be a real number.
 */
function whatsappUrl(mobile: string | null | undefined): string | null {
  if (!mobile) return null;
  const digits = mobile.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}

function QuickLinks({ email, mobile }: { email: string; mobile: string | null }) {
  const wa = whatsappUrl(mobile);
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          aria-label="Message on WhatsApp"
          title="Message on WhatsApp"
          className="inline-flex items-center justify-center w-[18px] h-[18px] text-[#25D366] hover:brightness-110"
        >
          <WaIcon />
        </a>
      )}
      <a
        href={`mailto:${email}`}
        aria-label={`Quick email to ${email}`}
        title={`Quick email to ${email}`}
        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm bg-[color:var(--navy)] text-white hover:brightness-110"
      >
        <MailIcon />
      </a>
    </span>
  );
}

function WaIcon() {
  // Official WhatsApp glyph, rendered in whatever color the parent sets via
  // `fill="currentColor"`. No internal padding — the phone + bubble fill the
  // full 18×18 badge.
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function MatchLine({ info }: { info: MatchInfo | undefined }) {
  if (!info) return null;
  return (
    <div className="mt-0.5 text-[11px] text-emerald-900/80">
      <span className="font-semibold text-emerald-800">{info.label}:</span>{" "}
      <span className="italic">{info.snippet}</span>
    </div>
  );
}

function ParseChip({ label, tone = "default" }: { label: string; tone?: "default" | "diversity" | "rank" }) {
  const base = "text-[11px] font-semibold px-2 py-0.5 rounded border";
  const palette =
    tone === "diversity"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "rank"
        ? "bg-indigo-50 border-indigo-200 text-indigo-800"
        : "bg-white border-[color:var(--rule)] text-[color:var(--navy-ink)]";
  return <span className={`${base} ${palette}`}>{label}</span>;
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-2.5 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-top ${className}`}>{children}</td>;
}

// Mobile-only row of "Label: value · Label: value" that gracefully hides any
// pair whose value is blank.
function Thumb({
  url, firstName, email, size,
}: {
  url: string | null;
  firstName: string | null;
  email: string;
  size: number;
}) {
  const letter = (firstName?.[0] ?? email[0] ?? "?").toUpperCase();
  const common = "rounded-full border border-[color:var(--rule)] shrink-0 overflow-hidden";
  const style: React.CSSProperties = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${common} object-cover bg-ivory-2`}
        style={style}
      />
    );
  }
  return (
    <div
      className={`${common} bg-ivory-2 flex items-center justify-center text-[color:var(--muted)] font-sans font-bold`}
      style={{ ...style, fontSize: Math.round(size * 0.42) }}
    >
      {letter}
    </div>
  );
}

function IndustryGroupSelect({
  industryCounts, selected,
}: {
  industryCounts: IndustryOption[];
  selected: IndustryGroup | undefined;
}) {
  // Compute per-group counts by summing the counts of each LinkedIn industry
  // that maps into that group. Industries with no mapping fall into "Other".
  const counts: Record<IndustryGroup, number> = Object.fromEntries(
    INDUSTRY_GROUPS.map((g) => [g, 0])
  ) as Record<IndustryGroup, number>;
  for (const { value, count } of industryCounts) {
    const g = INDUSTRY_TO_GROUP[value] ?? "Other";
    counts[g] += count;
  }
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        Industry
      </span>
      <select
        name="industryGroup"
        defaultValue={selected ?? ""}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      >
        <option value="">Any</option>
        {INDUSTRY_GROUPS.map((g) => (
          <option key={g} value={g}>
            {g} ({counts[g]})
          </option>
        ))}
      </select>
    </label>
  );
}

function CompanyField({ options, value }: { options: CompanyOption[]; value?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        Current company
      </span>
      <input
        list="alumni-company-list"
        name="company"
        defaultValue={value ?? ""}
        placeholder="e.g. Google"
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
      <datalist id="alumni-company-list">
        {options.map((o) => (
          <option key={`${o.name}|${o.id ?? ""}`} value={o.name}>
            {o.count} alum{o.count === 1 ? "" : "s"}
          </option>
        ))}
      </datalist>
    </label>
  );
}

function MetaLine({ pairs }: { pairs: [string, string | number | null | undefined][] }) {
  const filled = pairs.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (filled.length === 0) return null;
  return (
    <div className="text-xs text-[color:var(--muted)] leading-relaxed flex flex-wrap gap-x-2 gap-y-0.5 break-words">
      {filled.map(([label, value]) => (
        <span key={label} className="inline-block min-w-0 break-words">
          <span className="uppercase tracking-wider text-[10px] mr-1">{label}:</span>
          <span className="text-[color:var(--navy-ink)]">{value}</span>
        </span>
      ))}
    </div>
  );
}
