import Link from "next/link";
import { countAlumni, getAlumniByIds, type AlumniFilters } from "@/lib/alumni-query";
import ComposeForm from "./ComposeForm";

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

export default async function EmailPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  // Explicit per-row selection from /admin/alumni takes precedence over filters.
  const rawIds = sp["ids"];
  const idList = (Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [])
    .flatMap((v) => String(v).split(","))
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  let filters: AlumniFilters;
  let recipientCount: number;
  let selectedNames: string[] = [];

  if (idList.length > 0) {
    const rows = await getAlumniByIds(idList);
    filters = { ids: rows.map((r) => r.id) };
    recipientCount = rows.length;
    selectedNames = rows.map(
      (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email
    );
  } else {
    // Inherit the alumni search filter shape, but force subscription=subscribed.
    filters = {
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
      subscription: "subscribed",
    };
    recipientCount = await countAlumni(filters);
  }

  const filterBackHref = "/admin/alumni?" + new URLSearchParams(
    Object.entries({
      q: filters.q,
      college: filters.college,
      region: filters.region,
      origin: filters.origin,
      city: filters.city,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      help: filters.help,
      includeNonAlums: filters.includeNonAlums ? "1" : undefined,
      includeMovedOut: filters.includeMovedOut ? "1" : undefined,
    }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]
  ).toString();

  const hasAnyFilter = Object.entries(filters).some(([k, v]) => {
    if (k === "subscription") return false;
    return v !== undefined && v !== "" && v !== false;
  });

  return (
    <div className="max-w-[820px]">
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">Send email</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        {idList.length > 0 ? (
          <>
            {idList.length} recipient{idList.length === 1 ? "" : "s"} hand-selected from Alumni. {" "}
            <Link href="/admin/alumni" className="text-navy underline">Back to Alumni →</Link>
          </>
        ) : hasAnyFilter ? (
          <>
            Recipients scoped by filters from Alumni search. {" "}
            <Link href={filterBackHref} className="text-navy underline">Adjust filters →</Link>
          </>
        ) : (
          <>
            No filters set — will email every <strong>subscribed</strong> alumnus. {" "}
            <Link href="/admin/alumni" className="text-navy underline">Add filters →</Link>
          </>
        )}
      </p>

      {idList.length > 0 ? (
        <SelectedSummary names={selectedNames} count={recipientCount} />
      ) : (
        <FilterSummary filters={filters} count={recipientCount} />
      )}

      <div className="h-6" />

      <ComposeForm recipientCount={recipientCount} filters={filters} />
    </div>
  );
}

function SelectedSummary({ names, count }: { names: string[]; count: number }) {
  return (
    <div className="bg-ivory-2 border border-[color:var(--rule)] rounded-[6px] p-4 text-sm">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
          {count.toLocaleString()} {count === 1 ? "recipient" : "recipients"}
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          Hand-selected — unsubscribed rows silently dropped.
        </div>
      </div>
      {names.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {names.slice(0, 30).map((n, i) => (
            <span
              key={`${n}-${i}`}
              className="text-[11px] text-[color:var(--navy-ink)] bg-white border border-[color:var(--rule)] rounded-full px-2.5 py-0.5"
            >
              {n}
            </span>
          ))}
          {names.length > 30 && (
            <span className="text-[11px] text-[color:var(--muted)]">+ {names.length - 30} more</span>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSummary({ filters, count }: { filters: AlumniFilters; count: number }) {
  const chips: string[] = [];
  if (filters.q) chips.push(`search: "${filters.q}"`);
  if (filters.college) chips.push(`College: ${filters.college}`);
  if (filters.region) chips.push(`Region: ${filters.region}`);
  if (filters.origin) chips.push(`Origin: ${filters.origin}`);
  if (filters.city) chips.push(`City: ${filters.city}`);
  if (filters.yearFrom) chips.push(`Grad year ≥ ${filters.yearFrom}`);
  if (filters.yearTo) chips.push(`Grad year ≤ ${filters.yearTo}`);
  if (filters.help) chips.push(`Help: ${filters.help}`);
  if (filters.includeNonAlums) chips.push("including friends & parents");
  if (filters.includeMovedOut) chips.push("including moved-out");
  return (
    <div className="bg-ivory-2 border border-[color:var(--rule)] rounded-[6px] p-4 text-sm">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
          {count.toLocaleString()} {count === 1 ? "recipient" : "recipients"}
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          Excludes unsubscribed. Subscription filter is forced to "subscribed" here.
        </div>
      </div>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="text-[11px] text-[color:var(--navy-ink)] bg-white border border-[color:var(--rule)] rounded-full px-2.5 py-0.5"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
