import Link from "next/link";
import {
  listVolunteerSignups,
  VOLUNTEER_AREAS,
  type VolunteerArea,
  type VolunteerMatchStatus,
} from "@/lib/volunteer-signups";
import { toggleContactedAction } from "./actions";
import { VolunteerLinkPicker } from "@/components/admin/VolunteerLinkPicker";

export const dynamic = "force-dynamic";

const AREA_LABEL: Record<VolunteerArea, string> = Object.fromEntries(
  VOLUNTEER_AREAS.map((a) => [a.value, a.label])
) as Record<VolunteerArea, string>;

function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function HelpOutAdminPage() {
  const rows = await listVolunteerSignups();

  const total = rows.length;
  const matchedCount = rows.filter((r) => r.match_status === "matched").length;
  const reviewCount = rows.filter((r) => r.match_status === "needs_review").length;
  const pendingCount = rows.filter((r) => !r.contacted_at).length;

  return (
    <div className="max-w-[1100px]">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">
            Help Out signups
          </h1>
          <p className="text-[color:var(--muted)] text-sm mt-1">
            Volunteer interest from{" "}
            <Link href="/help-out" className="text-navy underline">
              /help-out
            </Link>
            . The matcher (same one used for ticket purchases) auto-links
            high-confidence matches; ambiguous and unmatched ones show
            &ldquo;Link to alumni&rdquo; for manual triage.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Total" value={total} />
        <Stat label="Matched" value={matchedCount} tone="emerald" />
        <Stat label="Needs review" value={reviewCount} tone="amber" />
        <Stat label="Pending follow-up" value={pendingCount} tone="amber" />
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-sm text-[color:var(--muted)]">
          No signups yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const matchedDisplay = r.alumni_id
              ? [r.alumni_first_name, r.alumni_last_name]
                  .filter(Boolean)
                  .join(" ") || "(matched, name missing)"
              : null;
            const matchedSub =
              r.alumni_uwc_college || r.alumni_grad_year
                ? [r.alumni_uwc_college, r.alumni_grad_year]
                    .filter(Boolean)
                    .join(" · ")
                : null;
            return (
              <li
                key={r.id}
                className={`bg-white border rounded-[10px] p-5 ${
                  r.contacted_at
                    ? "border-[color:var(--rule)] opacity-70"
                    : "border-[color:var(--rule)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-[color:var(--navy-ink)] text-base">
                        {r.submitted_name || "(no name)"}
                      </span>
                      <MatchBadge
                        status={r.match_status}
                        confidence={r.match_confidence}
                      />
                      {r.contacted_at && (
                        <span className="bg-slate-50 text-slate-700 border border-slate-200 text-[10px] tracking-[.18em] uppercase font-bold px-2 py-0.5 rounded-full">
                          Contacted
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[color:var(--muted)] mb-2">
                      <a
                        href={`mailto:${r.submitted_email}`}
                        className="text-navy hover:underline"
                      >
                        {r.submitted_email || "(no email)"}
                      </a>{" "}
                      · {fmtDateTime(r.created_at)}
                    </div>
                    {matchedDisplay ? (
                      <div className="text-xs text-[color:var(--muted)] mb-2">
                        <span className="font-semibold text-[color:var(--navy-ink)]">
                          Linked to:
                        </span>{" "}
                        {matchedDisplay}
                        {matchedSub && (
                          <span className="italic">
                            {" "}
                            &middot; {matchedSub}
                          </span>
                        )}{" "}
                        ·{" "}
                        <Link
                          href={`/admin/alumni/${r.alumni_id}`}
                          className="text-navy hover:underline"
                        >
                          open record →
                        </Link>
                        {r.match_reason && (
                          <span className="italic ml-1 text-[color:var(--muted-2)]">
                            ({r.match_reason})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs mb-2">
                        <span className="text-[color:var(--muted)]">
                          {r.match_reason || "Not matched."}
                        </span>{" "}
                        <VolunteerLinkPicker
                          signupId={r.id}
                          initialQuery={r.submitted_name || r.submitted_email}
                        />
                      </div>
                    )}
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {r.areas.map((a) => (
                        <span
                          key={a}
                          className="text-[11px] bg-navy/10 text-navy px-2 py-0.5 rounded-full font-semibold"
                        >
                          {AREA_LABEL[a] ?? a}
                        </span>
                      ))}
                    </div>
                    {r.areas.includes("national") && r.national_committee_choice && (
                      <div className="text-xs text-[color:var(--muted)] mb-1">
                        <span className="font-semibold text-[color:var(--navy-ink)]">
                          National committee:
                        </span>{" "}
                        {r.national_committee_choice}
                      </div>
                    )}
                    {r.note && (
                      <div className="mt-2 text-sm text-[color:var(--navy-ink)] bg-ivory-2 border-l-2 border-navy px-3 py-2 rounded-[2px] whitespace-pre-wrap">
                        {r.note}
                      </div>
                    )}
                  </div>
                  <form action={toggleContactedAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      type="hidden"
                      name="contacted"
                      value={r.contacted_at ? "0" : "1"}
                    />
                    <button
                      type="submit"
                      className={`text-xs font-semibold px-3 py-2 rounded border whitespace-nowrap ${
                        r.contacted_at
                          ? "border-[color:var(--rule)] text-[color:var(--muted)] hover:text-navy"
                          : "border-navy text-navy hover:bg-navy hover:text-white"
                      }`}
                    >
                      {r.contacted_at ? "Mark uncontacted" : "Mark contacted"}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MatchBadge({
  status,
  confidence,
}: {
  status: VolunteerMatchStatus | null;
  confidence: string | null;
}) {
  if (status === "matched") {
    return (
      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] tracking-[.18em] uppercase font-bold px-2 py-0.5 rounded-full">
        Matched{confidence ? ` · ${confidence}` : ""}
      </span>
    );
  }
  if (status === "needs_review") {
    return (
      <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] tracking-[.18em] uppercase font-bold px-2 py-0.5 rounded-full">
        Needs review
      </span>
    );
  }
  return (
    <span className="bg-slate-50 text-slate-700 border border-slate-200 text-[10px] tracking-[.18em] uppercase font-bold px-2 py-0.5 rounded-full">
      Not in DB
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber";
}) {
  const valueColor =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
      ? "text-amber-700"
      : "text-[color:var(--navy-ink)]";
  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className={`mt-1 font-sans text-2xl font-bold ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
