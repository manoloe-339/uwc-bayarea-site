import Link from "next/link";
import { COLLEGES } from "@/lib/uwc-colleges";
import { REGIONS } from "@/lib/region";
import { searchAlumni, countAlumni, type AlumniFilters } from "@/lib/alumni-query";
import YearFilter from "@/components/admin/YearFilter";

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

export default async function AlumniPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
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
    subscription: (pickStr(sp, "subscription") as AlumniFilters["subscription"]) ?? "subscribed",
  };

  const [rows, total] = await Promise.all([searchAlumni(filters, 500), countAlumni(filters)]);

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
          className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded"
        >
          Export CSV
        </a>
      </div>

      <form
        method="GET"
        key={JSON.stringify(filters)}
        className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field label="Search (name, city, bio, work…)" name="q" defaultValue={filters.q} placeholder="e.g. finance" span="lg:col-span-2" />
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
        <Field label="Origin contains" name="origin" defaultValue={filters.origin} placeholder="e.g. Brazil" />
        <Field label="City contains" name="city" defaultValue={filters.city} placeholder="e.g. San Francisco" />
        <YearFilter initialFrom={filters.yearFrom} initialTo={filters.yearTo} />
        <Field label="Help tag contains" name="help" defaultValue={filters.help} placeholder="e.g. events" />
        <Select label="Subscription" name="subscription" defaultValue={filters.subscription}>
          <option value="subscribed">Subscribed only</option>
          <option value="unsubscribed">Unsubscribed only</option>
          <option value="any">Any</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-[color:var(--navy-ink)] sm:col-span-2">
          <input
            type="checkbox"
            name="includeNonAlums"
            value="1"
            defaultChecked={filters.includeNonAlums}
          />
          Include friends &amp; parents
        </label>
        <label className="flex items-center gap-2 text-sm text-[color:var(--navy-ink)] sm:col-span-2">
          <input
            type="checkbox"
            name="includeMovedOut"
            value="1"
            defaultChecked={filters.includeMovedOut}
          />
          Include alumni who moved out of the Bay Area
        </label>
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

      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
            <tr>
              <Th>Name</Th>
              <Th>College</Th>
              <Th>Year</Th>
              <Th>Origin</Th>
              <Th>City</Th>
              <Th>Region</Th>
              <Th>Company</Th>
              <Th>Email</Th>
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
                  <Link
                    href={`/admin/alumni/${r.id}`}
                    className="font-semibold text-navy hover:underline"
                  >
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}
                  </Link>
                  {r.affiliation && r.affiliation !== "Alum" && (
                    <span className="ml-2 text-[10px] text-[color:var(--muted)] uppercase tracking-wider">
                      {r.affiliation}
                    </span>
                  )}
                  {r.flags?.length > 0 && (
                    <span className="ml-2 text-[10px] text-orange-700 uppercase tracking-wider">
                      {r.flags.join(", ")}
                    </span>
                  )}
                </Td>
                <Td>{r.uwc_college ?? <span className="text-[color:var(--muted)]">—</span>}</Td>
                <Td>{r.grad_year ?? <span className="text-[color:var(--muted)]">—</span>}</Td>
                <Td>{r.origin ?? "—"}</Td>
                <Td>{r.current_city ?? "—"}</Td>
                <Td>{r.region ?? <span className="text-[color:var(--muted)]">—</span>}</Td>
                <Td>{r.company ?? <span className="text-[color:var(--muted)]">—</span>}</Td>
                <Td>
                  <a href={`mailto:${r.email}`} className="text-navy hover:underline">{r.email}</a>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-top">{children}</td>;
}
