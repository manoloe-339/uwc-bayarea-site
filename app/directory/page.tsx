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
import { SaveButton } from "@/components/directory/SaveButton";
import { DirectoryNLToggle } from "@/components/directory/DirectoryNLToggle";
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

  const [rows, total, mySaves, industries] = await Promise.all([
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
  ]);
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
          Directory
        </h1>
        <p className="text-sm text-[color:var(--muted)] mt-1.5 max-w-[68ch]">
          Search registered alumni and connect with them on LinkedIn.
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
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
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
              placeholder="e.g. Jane Doe — or just Doe"
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
        )}

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            College
          </span>
          <select
            name="college"
            defaultValue={filters.college ?? ""}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
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
            Region
          </span>
          <select
            name="region"
            defaultValue={filters.region ?? ""}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
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
            Grad year (from)
          </span>
          <input
            name="yearFrom"
            type="number"
            defaultValue={filters.yearFrom ?? ""}
            placeholder="e.g. 2010"
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Grad year (to)
          </span>
          <input
            name="yearTo"
            type="number"
            defaultValue={filters.yearTo ?? ""}
            placeholder="e.g. 2020"
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Industry
          </span>
          <select
            name="industry"
            defaultValue={filters.industry ?? ""}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
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
          <label className="flex items-center gap-2 mt-1 text-[11px] text-[color:var(--muted)]">
            <input
              type="checkbox"
              name="industriesIncludePast"
              value="1"
              defaultChecked={!!filters.industriesIncludePast}
            />
            <span>Include past roles</span>
          </label>
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Company size
          </span>
          <select
            name="companySizeBand"
            defaultValue={filters.companySizeBand ?? ""}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
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
            Experience
          </span>
          <select
            name="expBand"
            defaultValue={filters.expBand ?? ""}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
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
            City contains
          </span>
          <input
            name="city"
            defaultValue={filters.city ?? ""}
            placeholder="e.g. San Francisco"
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Origin contains
          </span>
          <input
            name="origin"
            defaultValue={filters.origin ?? ""}
            placeholder="e.g. Brazil"
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Company contains
          </span>
          <input
            name="company"
            defaultValue={filters.company ?? ""}
            placeholder="e.g. Stripe"
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            University contains
          </span>
          <input
            name="university"
            defaultValue={filters.university ?? ""}
            placeholder="e.g. Stanford"
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
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
    status: "not_contacted" | "invite_sent" | "connected" | "replied" | "met" | "follow_up_later" | "closed";
    reason: "job" | "referral" | "mentor" | "founder" | "industry" | "other" | null;
    note: string | null;
  } | null;
}) {
  const name =
    [row.first_name, row.last_name].filter(Boolean).join(" ") || "(no name)";
  const sub = [row.uwc_college, row.grad_year].filter(Boolean).join(" · ");
  const role =
    row.current_title && row.current_company
      ? `${row.current_title} at ${row.current_company}`
      : row.current_title || row.current_company || row.headline || null;
  const linkedin = linkedinHref(row.linkedin_url);

  return (
    <li className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 hover:border-navy">
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
          <Link
            href={`/directory/${row.id}`}
            className="block font-semibold text-[color:var(--navy-ink)] hover:underline"
          >
            {name}
          </Link>
          <div className="text-xs text-[color:var(--muted)] mt-0.5 truncate">
            {sub}
            {row.current_city && (
              <span>
                {sub ? " · " : ""}
                {row.current_city}
              </span>
            )}
          </div>
          {role && (
            <div className="text-xs text-[color:var(--navy-ink)] mt-1 line-clamp-2">
              {role}
            </div>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs">
            {linkedin ? (
              <a
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-navy font-semibold hover:underline"
              >
                Open on LinkedIn → invite ↗
              </a>
            ) : (
              <span className="text-[color:var(--muted)] italic">
                No LinkedIn on file
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 pl-[76px]">
        <SaveButton
          alumniId={row.id}
          initial={initialSave}
          canSave={canSave}
        />
      </div>
    </li>
  );
}
