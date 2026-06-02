import Link from "next/link";
import {
  listSignupSubmissions,
  DIFFED_FIELDS,
  type DiffedField,
  type FieldChange,
  type SignupSubmissionRow,
} from "@/lib/signup-submissions";
import {
  markSubmissionReadAction,
  dismissSubmissionAction,
} from "./actions";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<DiffedField, string> = {
  first_name: "First name",
  last_name: "Last name",
  mobile: "Mobile",
  linkedin_url: "LinkedIn",
  origin: "Origin",
  uwc_college: "UWC college",
  grad_year: "Grad year",
  current_city: "Current city",
  affiliation: "Affiliation",
  company: "Company",
  help_tags: "Help tags",
  national_committee: "National committee",
  about: "About",
  questions: "Questions",
  studying: "Studying",
  study_location: "Study location",
  working: "Working",
  work_location: "Work location",
  parent_of_name: "Parent of (name)",
  parent_of_uwc_college: "Parent of (college)",
  parent_of_grad_year: "Parent of (grad year)",
  how_heard: "How heard",
};

function fmtDateTime(d: Date): string {
  const dd = d instanceof Date ? d : new Date(String(d));
  return dd.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtValue(v: FieldChange["from"]): string {
  if (v == null) return "—";
  return String(v);
}

export default async function ReSignupsPage() {
  const rows = await listSignupSubmissions({ onlyUnreadResubmissions: true });

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools" className="text-[color:var(--muted)] hover:text-navy">
          ← Tools
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Re-signups
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-8">
        When an existing alum re-submits the signup form, this queue surfaces
        what they tried to change. The signup upsert preserves existing
        values on re-submission, so the rows tagged{" "}
        <strong className="text-amber-700">preserved</strong> are the most
        interesting: the user submitted a new value but the existing data
        on the alumni record was kept. Decide manually whether to apply
        the user&rsquo;s update.
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
          No pending re-signups.
        </div>
      ) : (
        <ul className="space-y-5">
          {rows.map((row) => (
            <SubmissionCard key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmissionCard({ row }: { row: SignupSubmissionRow }) {
  const name =
    [row.alum_first_name, row.alum_last_name].filter(Boolean).join(" ") ||
    "(no name on file)";
  const sub = [row.alum_uwc_college, row.alum_grad_year]
    .filter(Boolean)
    .join(" · ");

  // Order diff entries by the canonical field order so the most important
  // identity fields render first.
  const entries: Array<[DiffedField, FieldChange]> = [];
  for (const f of DIFFED_FIELDS) {
    const c = row.diff?.[f];
    if (c) entries.push([f, c]);
  }

  return (
    <li className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <Link
            href={`/admin/alumni/${row.alumni_id}`}
            className="font-semibold text-[color:var(--navy-ink)] hover:underline"
          >
            {name}
          </Link>
          <div className="text-xs text-[color:var(--muted)] mt-0.5">
            {row.alum_email}
            {sub && <span className="italic"> · {sub}</span>}
          </div>
          <div className="text-xs text-[color:var(--muted)] mt-0.5">
            Re-submitted {fmtDateTime(row.submitted_at)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <form action={markSubmissionReadAction}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className="text-xs font-semibold text-navy hover:underline"
            >
              Mark read
            </button>
          </form>
          <form action={dismissSubmissionAction}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className="text-xs text-[color:var(--muted)] hover:text-rose-700"
            >
              Dismiss
            </button>
          </form>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-xs text-[color:var(--muted)] italic">
          No field changes detected — re-submitted with identical data.
        </div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[10px] tracking-[.22em] uppercase text-[color:var(--muted)]">
              <th className="text-left py-1 pr-4 font-semibold w-[28%]">Field</th>
              <th className="text-left py-1 pr-4 font-semibold w-[28%]">Was</th>
              <th className="text-left py-1 pr-4 font-semibold w-[34%]">Submitted</th>
              <th className="text-left py-1 font-semibold w-[10%]">State</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([field, change]) => (
              <tr
                key={field}
                className="border-t border-[color:var(--rule)] align-top"
              >
                <td className="py-1.5 pr-4 text-[12px] font-semibold text-navy">
                  {FIELD_LABELS[field]}
                </td>
                <td className="py-1.5 pr-4 text-[12px] text-[color:var(--muted)] break-words">
                  {fmtValue(change.from)}
                </td>
                <td className="py-1.5 pr-4 text-[12px] text-[color:var(--navy-ink)] break-words">
                  {fmtValue(change.to)}
                </td>
                <td className="py-1.5 text-[10px] tracking-[.18em] uppercase font-semibold">
                  {change.applied ? (
                    <span className="text-emerald-700">Applied</span>
                  ) : (
                    <span className="text-amber-700">Preserved</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}
