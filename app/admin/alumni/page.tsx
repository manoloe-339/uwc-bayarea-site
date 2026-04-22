import Link from "next/link";
import { COLLEGES } from "@/lib/uwc-colleges";
import { REGIONS } from "@/lib/region";
import { sql } from "@/lib/db";
import { searchAlumni, countAlumni, FOLLOWUP_REASONS, FOLLOWUP_REASON_LABELS, type AlumniFilters, type ExperienceBand } from "@/lib/alumni-query";
import { INDUSTRY_GROUPS, INDUSTRY_TO_GROUP, type IndustryGroup } from "@/lib/industry-groups";
import { loadEngagement, scoreAlumni, splitEventResults, type ScoredAlum } from "@/lib/event-ranking";
import YearFilter from "@/components/admin/YearFilter";
import { SelectAllCheckbox, SelectedCountLink } from "@/components/admin/AlumniSelection";
import { AlumniOptionsSection } from "@/components/admin/AlumniOptionsSection";

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
    companyIdMap,
    expBand: pickStr(sp, "expBand") as ExperienceBand | undefined,
    uwcVerified: pickStr(sp, "uwcVerified") as AlumniFilters["uwcVerified"],
    hasPhoto: pickStr(sp, "hasPhoto") === "1",
    linkedin: pickStr(sp, "linkedin") as AlumniFilters["linkedin"],
    followup: pickStr(sp, "followup") as AlumniFilters["followup"],
    engagement: pickStr(sp, "engagement") as AlumniFilters["engagement"],
  };

  const showPhotos = pickStr(sp, "showPhotos") === "1";
  const eventMode = pickStr(sp, "eventMode") === "1";
  const rankByEngagement = pickStr(sp, "rankByEngagement") === "1";
  const rankByDiversity = pickStr(sp, "rankByDiversity") === "1";
  const rankByRecency = pickStr(sp, "rankByRecency") === "1";
  const eventSize = Math.max(1, Math.min(100, pickNum(sp, "eventSize") ?? 20));
  const addToList = pickStr(sp, "addToList") || null;
  let addToListName: string | null = null;
  if (addToList) {
    const { getInviteList } = await import("@/lib/invite-lists");
    const list = await getInviteList(addToList);
    addToListName = list?.name ?? null;
  }

  const [rows, total] = await Promise.all([searchAlumni(filters, 500), countAlumni(filters)]);

  let scored: ScoredAlum[] = [];
  let topRanked: ScoredAlum[] = [];
  let honorable: ScoredAlum[] = [];
  if (eventMode) {
    const engagement = rankByEngagement
      ? await loadEngagement(rows.map((r) => r.id))
      : new Map();
    scored = scoreAlumni(rows, { rankByEngagement, rankByDiversity, rankByRecency }, engagement);
    const split = splitEventResults(scored, eventSize);
    topRanked = split.top;
    honorable = split.honorable;
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && v !== "") qs.set(k, String(v));
  }
  const exportHref = `/api/admin/alumni/export?${qs.toString()}`;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Alumni lookup</h1>
          <p className="text-[color:var(--muted)] text-sm">
            {total.toLocaleString()} {total === 1 ? "match" : "matches"}
            {rows.length < total ? ` · showing first ${rows.length}` : ""}
          </p>
        </div>
        <a
          href={exportHref}
          className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
        >
          Export CSV
        </a>
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

      <form
        method="GET"
        key={JSON.stringify({ ...filters, eventMode, rankByEngagement, rankByDiversity, rankByRecency, eventSize })}
        className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Row 1 — full-width free-text search */}
        <Field
          label="Search (name, city, bio, work…)"
          name="q"
          defaultValue={filters.q}
          placeholder="e.g. finance"
          span="sm:col-span-2 lg:col-span-4"
        />

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

        {/* Row 3 — origin / city / current company / experience */}
        <Field label="Origin contains" name="origin" defaultValue={filters.origin} placeholder="e.g. Brazil" />
        <Field label="City contains" name="city" defaultValue={filters.city} placeholder="e.g. San Francisco" />
        <CompanyField options={companies} value={filters.company} />
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

        {/* Options — grouped checkboxes (client component: Event ranking reveals on-click) */}
        <AlumniOptionsSection
          hasPhoto={!!filters.hasPhoto}
          showPhotos={showPhotos}
          includeNonAlums={!!filters.includeNonAlums}
          includeMovedOut={!!filters.includeMovedOut}
          eventMode={eventMode}
          rankByEngagement={rankByEngagement}
          rankByDiversity={rankByDiversity}
          rankByRecency={rankByRecency}
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
      </form>

      <div className="flex items-center justify-between mb-3 text-sm">
        <p className="font-sans font-semibold text-[color:var(--navy-ink)]">
          {total.toLocaleString()} {total === 1 ? "match" : "matches"}
          {eventMode ? (
            <span className="font-normal text-[color:var(--muted)]">
              {" · ranking top "}{topRanked.length}
              {honorable.length > 0 ? ` · ${honorable.length} honorable mentions` : ""}
            </span>
          ) : rows.length < total ? (
            <span className="font-normal text-[color:var(--muted)]"> · showing first {rows.length}</span>
          ) : null}
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
                          <Link href={`/admin/alumni/${r.id}`} className="font-semibold text-navy hover:underline block">
                            {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}
                          </Link>
                          <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                            {r.uwc_college ?? "—"}
                            {r.grad_year ? ` · ${r.grad_year}` : ""}
                            {r.location_city ? ` · ${r.location_city}` : ""}
                          </div>
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
                      <span className="inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded bg-ivory-2 border border-[color:var(--rule)] text-sm font-semibold text-navy">
                        {r.score}
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
                      href={`/admin/alumni/${r.id}`}
                      className="font-semibold text-navy hover:underline block"
                    >
                      {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}
                    </Link>
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
                className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 flex gap-3 text-sm"
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
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
                    <Link
                      href={`/admin/alumni/${r.id}`}
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
                        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm bg-[#0A66C2] text-white text-[10px] font-bold"
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
                    <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 rounded bg-ivory-2 border border-[color:var(--rule)] text-xs font-semibold text-navy shrink-0">
                      {r.score}
                    </span>
                    <Link href={`/admin/alumni/${r.id}`} className="font-semibold text-navy hover:underline truncate">
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
    <div className="text-xs text-[color:var(--muted)] leading-relaxed">
      {filled.map(([label, value], i) => (
        <span key={label}>
          {i > 0 && <span className="mx-1.5 opacity-60">·</span>}
          <span className="uppercase tracking-wider text-[10px] mr-1">{label}:</span>
          <span className="text-[color:var(--navy-ink)]">{value}</span>
        </span>
      ))}
    </div>
  );
}
