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

export default async function GenderToolPage() {
  const all = await listAlumniForGenderReview();
  const classified = all.filter((a) => a.gender != null);
  const unclassified = all.filter((a) => a.gender == null);
  const unknown = all.filter((a) => a.gender === "unknown");
  const lowConf = all.filter(
    (a) => a.gender != null && a.gender !== "unknown" && a.gender_source !== "admin" && (a.gender_confidence ?? 0) < 0.75
  );

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

      <p className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-2">
        All alumni · needs-review rows highlighted
      </p>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-ivory-2 text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
            <tr>
              <th className="text-left px-3 py-2">Alumnus</th>
              <th className="text-left px-3 py-2">Origin</th>
              <th className="text-left px-3 py-2">Gender</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">Conf</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {all.map((a) => {
              const needsReview = a.gender == null || a.gender === "unknown" || ((a.gender_confidence ?? 0) < 0.75 && a.gender_source !== "admin");
              const name = [a.first_name, a.last_name].filter(Boolean).join(" ");
              const classifyOne = classifyOneGenderAction.bind(null, a.id);
              return (
                <tr key={a.id} className={`border-t border-[color:var(--rule)] ${needsReview ? "bg-orange-50/40" : ""}`}>
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

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`bg-white border ${accent ? "border-orange-300" : "border-[color:var(--rule)]"} rounded-[10px] p-4`}>
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">{label}</div>
      <div className="text-2xl font-sans font-bold text-[color:var(--navy-ink)] mt-1">{value}</div>
    </div>
  );
}
