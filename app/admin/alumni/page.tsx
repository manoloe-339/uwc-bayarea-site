import Link from "next/link";
import { COLLEGES } from "@/lib/uwc-colleges";
import { REGIONS } from "@/lib/region";
import { searchAlumni, countAlumni, type AlumniFilters } from "@/lib/alumni-query";
import YearFilter from "@/components/admin/YearFilter";
import { SelectAllCheckbox, SelectedCountLink } from "@/components/admin/AlumniSelection";

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
    engagement: pickStr(sp, "engagement") as AlumniFilters["engagement"],
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
          className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
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
        <Select label="Email engagement" name="engagement" defaultValue={filters.engagement ?? ""}>
          <option value="">Any</option>
          <option value="opened_any">Opened any email</option>
          <option value="clicked_any">Clicked any link</option>
          <option value="never_opened">Received, never opened</option>
          <option value="never_received">Never received an email</option>
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

      <div className="flex items-center justify-end mb-3 text-sm">
        <SelectedCountLink formId="alumni-select-form" />
      </div>

      <form id="alumni-select-form" method="GET" action="/admin/email/campaigns/new">
        {/* ── Desktop: table view (md and up) ────────────────────────────── */}
        <div className="hidden md:block bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <Th>
                  <SelectAllCheckbox formId="alumni-select-form" />
                </Th>
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
                  <td colSpan={9} className="p-8 text-center text-[color:var(--muted)]">
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
                    <Link
                      href={`/admin/alumni/${r.id}`}
                      className="font-semibold text-navy hover:underline"
                    >
                      {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}
                    </Link>
                    {r.linkedin_url && (
                      <a
                        href={r.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="LinkedIn profile"
                        title="Open LinkedIn profile"
                        className="ml-1.5 inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm bg-[#0A66C2] text-white text-[10px] font-bold align-middle hover:brightness-110"
                      >
                        in
                      </a>
                    )}
                    <span className="ml-1.5">
                      <QuickLinks email={r.email} mobile={r.mobile} />
                    </span>
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
                  </div>
                  <MetaLine
                    pairs={[
                      ["College", r.uwc_college],
                      ["Year", r.grad_year ?? undefined],
                    ]}
                  />
                  <MetaLine
                    pairs={[
                      ["Origin", r.origin],
                      ["City", r.current_city],
                      ["Region", r.region],
                    ]}
                  />
                  <MetaLine pairs={[["Company", r.company]]} />
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
      </form>
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
          className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm bg-[#25D366] text-white hover:brightness-110"
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
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2a9.94 9.94 0 00-8.49 15.06L2 22l5.1-1.33A9.94 9.94 0 1012.04 2zm0 18.16a8.12 8.12 0 01-4.14-1.13l-.3-.18-3.03.79.81-2.95-.2-.31a8.15 8.15 0 1114.06 5.26 8.1 8.1 0 01-7.2.52zm4.47-6.1c-.25-.12-1.45-.72-1.67-.8-.22-.08-.38-.12-.55.12-.16.25-.63.8-.77.97-.14.16-.28.18-.53.06-.25-.12-1.04-.38-1.99-1.22-.74-.66-1.23-1.47-1.37-1.72-.14-.25-.02-.39.1-.51.11-.11.25-.28.37-.42.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.31s-.85.83-.85 2.02.87 2.35.99 2.51c.12.17 1.7 2.59 4.12 3.64.57.25 1.02.4 1.37.51.57.18 1.1.16 1.51.1.46-.07 1.45-.59 1.65-1.17.2-.58.2-1.08.14-1.17-.06-.1-.22-.16-.47-.28z"/>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-top">{children}</td>;
}

// Mobile-only row of "Label: value · Label: value" that gracefully hides any
// pair whose value is blank.
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
