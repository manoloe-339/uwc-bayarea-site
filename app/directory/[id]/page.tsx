import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getDirectoryAlumnus,
  getDirectoryCareers,
  logDirectoryProfileView,
} from "@/lib/directory-query";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import { getSaveForAlumnus, REASON_LABELS, STATUS_LABELS } from "@/lib/directory-saves";
import { linkedinHref } from "@/lib/linkedin-url";
import { FeedbackButton } from "@/components/directory/FeedbackButton";
import { SaveButton } from "@/components/directory/SaveButton";

export const dynamic = "force-dynamic";

function fmtCareerDate(d: string | null): string {
  if (!d) return "";
  // Stored as "M-YYYY" or similar from LinkedIn enrichment. Render as-is.
  return d;
}

function careerRange(start: string | null, end: string | null): string {
  const s = fmtCareerDate(start);
  const e = end ? fmtCareerDate(end) : "present";
  return s && e ? `${s} → ${e}` : s || e || "";
}

export default async function DirectoryProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const row = await getDirectoryAlumnus(id);
  if (!row) notFound();

  const careers = await getDirectoryCareers(id);

  // Identity + audit
  const session = await getCurrentDirectorySession();
  const userId = session?.kind === "user" ? session.user.id : null;
  const sessionId = session?.auditSessionId ?? "";
  if (sessionId) {
    void logDirectoryProfileView(sessionId, id, userId);
  }

  // Existing save state (if any) so the ★ Save button shows current values.
  const existingSave = userId ? await getSaveForAlumnus(userId, id) : null;
  const canSave = session?.kind === "user";

  const name =
    [row.first_name, row.last_name].filter(Boolean).join(" ") || "(no name)";
  const sub = [row.uwc_college, row.grad_year].filter(Boolean).join(" · ");
  const location = [row.current_city, row.region].filter(Boolean).join(" · ");
  const linkedin = linkedinHref(row.linkedin_url);

  return (
    <section className="max-w-[800px] mx-auto px-5 sm:px-7 py-8">
      <div className="mb-5 text-sm flex items-center justify-between">
        <Link
          href="/directory"
          className="text-[color:var(--muted)] hover:text-navy"
        >
          ← Back to directory
        </Link>
        <FeedbackButton alumniId={id} />
      </div>

      {existingSave && canSave && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-3 text-xs text-amber-900">
          <span className="font-bold">★ On your shortlist</span>
          {" — "}
          <span>Status: {STATUS_LABELS[existingSave.status]}</span>
          {existingSave.reason && (
            <span>{" · "}Reason: {REASON_LABELS[existingSave.reason]}</span>
          )}
          {existingSave.note && (
            <div className="mt-1 italic text-[color:var(--muted)]">
              &ldquo;{existingSave.note}&rdquo;
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 sm:p-8">
        <div className="flex items-start gap-5 mb-6">
          <div className="shrink-0 w-[110px] h-[110px] rounded-full overflow-hidden bg-[color:var(--ivory-2)]">
            {row.photo_url ? (
              <Image
                src={row.photo_url}
                alt=""
                width={110}
                height={110}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[color:var(--muted)] text-2xl font-bold">
                {name
                  .split(" ")
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-sans text-[28px] font-bold text-[color:var(--navy-ink)] leading-[1.1]">
              {name}
            </h1>
            {row.headline && (
              <p className="text-sm text-[color:var(--navy-ink)] italic mt-1">
                {row.headline}
              </p>
            )}
            <div className="text-xs text-[color:var(--muted)] mt-2 space-y-0.5">
              {sub && <div>{sub}</div>}
              {row.origin && <div>From {row.origin}</div>}
              {location && <div>{location}</div>}
            </div>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {linkedin ? (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#0A66C2] text-white px-4 py-2 rounded text-xs font-bold tracking-[.18em] uppercase hover:opacity-90"
                >
                  Open on LinkedIn → invite ↗
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 border border-dashed border-[color:var(--rule)] text-[color:var(--muted)] px-4 py-2 rounded text-xs font-bold tracking-[.18em] uppercase">
                  No LinkedIn on file
                </span>
              )}
            </div>
            <div className="mt-3">
              <SaveButton
                alumniId={id}
                initial={existingSave}
                canSave={canSave}
                variant="banner"
              />
            </div>
          </div>
        </div>

        {(row.current_title || row.current_company) && (
          <div className="mb-5">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
              Now
            </div>
            <div className="text-sm text-[color:var(--navy-ink)]">
              {row.current_title}
              {row.current_title && row.current_company && " at "}
              {row.current_company}
              {row.current_company_industry && (
                <span className="text-[color:var(--muted)]">
                  {" · "}
                  {row.current_company_industry}
                </span>
              )}
            </div>
          </div>
        )}

        {row.linkedin_about && (
          <div className="mb-5">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
              Bio
            </div>
            <p className="text-sm text-[color:var(--navy-ink)] leading-[1.55] whitespace-pre-wrap">
              {row.linkedin_about}
            </p>
          </div>
        )}

        {careers.length > 0 && (
          <div className="mb-2">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
              Past roles
            </div>
            <ul className="space-y-2">
              {careers.map((cc, i) => (
                <li
                  key={`${cc.alumni_id}-${i}`}
                  className="text-sm text-[color:var(--navy-ink)]"
                >
                  <span className="font-semibold">
                    {[cc.title, cc.company].filter(Boolean).join(" · ")}
                  </span>
                  {careerRange(cc.start_date, cc.end_date) && (
                    <span className="text-[color:var(--muted)]">
                      {" — "}
                      {careerRange(cc.start_date, cc.end_date)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
