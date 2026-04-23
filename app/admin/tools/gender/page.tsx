import Link from "next/link";
import { listAlumniForGenderReview } from "@/lib/gender-classifications";
import {
  runGenderClassifierAction,
  classifyOneGenderAction,
  setGenderManualAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function fmtConf(c: number | null): string {
  if (c == null) return "—";
  return `${Math.round(c * 100)}%`;
}

const GENDER_OPTIONS = [
  { value: "", label: "—" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "they", label: "They" },
  { value: "unknown", label: "Unknown" },
];

export default async function GenderToolPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; origin?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "all" || sp.view === "admin" ? sp.view : "needs";
  const originFilter = (sp.origin ?? "").trim().toLowerCase();

  const all = await listAlumniForGenderReview();
  const classified = all.filter((a) => a.gender != null);
  const unclassified = all.filter((a) => a.gender == null);
  const unknown = all.filter((a) => a.gender === "unknown");
  const lowConf = all.filter(
    (a) => a.gender != null && a.gender !== "unknown" && a.gender_source !== "admin" && (a.gender_confidence ?? 0) < 0.75
  );
  const needsReview = all.filter(
    (a) =>
      a.gender_source !== "admin" &&
      (a.gender == null || a.gender === "unknown" || (a.gender_confidence ?? 0) < 0.75)
  );
  const adminSet = all.filter((a) => a.gender_source === "admin");

  let visible =
    view === "needs" ? needsReview : view === "admin" ? adminSet : all;
  if (originFilter) {
    visible = visible.filter((a) => (a.origin ?? "").toLowerCase().includes(originFilter));
  }
  // Within needs-review, sort lowest-confidence + unknowns first
  if (view === "needs") {
    visible = [...visible].sort((a, b) => {
      const ac = a.gender == null ? -1 : a.gender === "unknown" ? 0 : a.gender_confidence ?? 1;
      const bc = b.gender == null ? -1 : b.gender === "unknown" ? 0 : b.gender_confidence ?? 1;
      return ac - bc;
    });
  }

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools" className="text-[color:var(--muted)] hover:text-navy">
          ← Admin tools
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Gender classifier
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Uses Claude Haiku + origin country to classify each alumnus as male, female,
        they, or unknown. Pronouns in the LinkedIn headline/about override name-based guesses.
        Admin overrides (via the dropdown below or on the detail page) are preserved
        and never re-classified automatically.
      </p>

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Total" value={all.length} />
        <Stat label="Classified" value={classified.length} />
        <Stat label="Unclassified" value={unclassified.length} />
        <Stat label="Needs review" value={unknown.length + lowConf.length} accent={unknown.length + lowConf.length > 0} />
      </div>

      <form action={runGenderClassifierAction} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="scope" value="unclassified" defaultChecked />
            Only unclassified ({unclassified.length})
          </label>
          <label className="flex items-center gap-2 text-sm mt-1">
            <input type="radio" name="scope" value="all" />
            Re-classify all ({all.length}) — skips admin overrides
          </label>
        </div>
        <button
          type="submit"
          className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold"
          disabled={all.length === 0}
        >
          Run classifier →
        </button>
      </form>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1 text-sm font-semibold">
          <ViewTab href="/admin/tools/gender?view=needs" active={view === "needs"} count={needsReview.length}>
            Needs review
          </ViewTab>
          <ViewTab href="/admin/tools/gender?view=all" active={view === "all"} count={all.length}>
            All
          </ViewTab>
          <ViewTab href="/admin/tools/gender?view=admin" active={view === "admin"} count={adminSet.length}>
            Admin-set
          </ViewTab>
        </div>
        <form method="GET" action="/admin/tools/gender" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="view" value={view} />
          <input
            type="text"
            name="origin"
            placeholder="Filter by origin (e.g. China)"
            defaultValue={sp.origin ?? ""}
            className="text-xs border border-[color:var(--rule)] rounded px-2 py-1 bg-white min-w-[180px]"
          />
          <button type="submit" className="text-xs text-navy font-semibold hover:underline">
            Apply
          </button>
          {originFilter && (
            <Link
              href={`/admin/tools/gender?view=${view}`}
              className="text-xs text-[color:var(--muted)] hover:text-navy"
            >
              clear
            </Link>
          )}
        </form>
      </div>
      <p className="text-[11px] tracking-[.22em] uppercase text-[color:var(--muted)] mb-2">
        Showing {visible.length} of {all.length}
      </p>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-ivory-2 text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
            <tr>
              <th className="text-left px-3 py-2 w-[56px]">Photo</th>
              <th className="text-left px-3 py-2">Alumnus</th>
              <th className="text-left px-3 py-2">Origin</th>
              <th className="text-left px-3 py-2">Gender</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">Conf</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[color:var(--muted)]">
                  Nothing in this view. ✓
                </td>
              </tr>
            )}
            {visible.map((a) => {
              const needsReviewRow = a.gender == null || a.gender === "unknown" || ((a.gender_confidence ?? 0) < 0.75 && a.gender_source !== "admin");
              const name = [a.first_name, a.last_name].filter(Boolean).join(" ");
              const classifyOne = classifyOneGenderAction.bind(null, a.id);
              const initial = (a.first_name?.[0] ?? "?").toUpperCase();
              return (
                <tr key={a.id} className={`border-t border-[color:var(--rule)] ${needsReviewRow ? "bg-orange-50/40" : ""}`}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/alumni/${a.id}`} className="block">
                      {a.photo_url ? (
                        <img
                          src={a.photo_url}
                          alt={name}
                          className="w-10 h-10 rounded-full object-cover bg-ivory-2 border border-[color:var(--rule)]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-ivory-2 border border-[color:var(--rule)] flex items-center justify-center text-[color:var(--muted)] text-sm font-sans font-bold">
                          {initial}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/alumni/${a.id}`} className="font-semibold text-navy hover:underline">
                      #{a.id} · {name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[color:var(--muted)]">{a.origin ?? "—"}</td>
                  <td className="px-3 py-2">
                    <form action={setGenderManualAction.bind(null, a.id)} className="inline-flex items-center gap-1">
                      <select
                        name="gender"
                        defaultValue={a.gender ?? ""}
                        className="border border-[color:var(--rule)] rounded px-1.5 py-0.5 text-xs bg-white"
                      >
                        {GENDER_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <button type="submit" className="text-[10px] text-navy hover:underline">Save</button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-[color:var(--muted)]">
                    {a.gender_source === "admin" ? "manual" : a.gender_source === "llm" ? "Haiku" : "—"}
                  </td>
                  <td className="px-3 py-2 text-[color:var(--muted)]">{fmtConf(a.gender_confidence)}</td>
                  <td className="px-3 py-2 text-right">
                    <form action={classifyOne}>
                      <button type="submit" className="text-[10px] text-navy hover:underline">Re-classify</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ViewTab({ href, active, count, children }: { href: string; active: boolean; count: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded border ${active ? "bg-navy text-white border-navy" : "bg-white text-navy border-[color:var(--rule)] hover:border-navy"}`}
    >
      {children} <span className={`text-xs ${active ? "text-white/70" : "text-[color:var(--muted)]"}`}>({count})</span>
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`bg-white border ${accent ? "border-orange-300" : "border-[color:var(--rule)]"} rounded-[10px] p-4`}>
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">{label}</div>
      <div className="text-2xl font-sans font-bold text-[color:var(--navy-ink)] mt-1">{value}</div>
    </div>
  );
}
