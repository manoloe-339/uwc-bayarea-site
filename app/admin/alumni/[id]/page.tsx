import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { COLLEGES, normalizeCollege, isPearson } from "@/lib/uwc-colleges";
import { parseGradYear } from "@/lib/gradyear";
import { cityToRegion, REGIONS } from "@/lib/region";
import { reasonLabel } from "@/lib/unsubscribe-reasons";
import { resubscribe } from "@/app/unsubscribe/actions";
import { fmtDate } from "@/lib/admin-time";
import { FOLLOWUP_REASONS, FOLLOWUP_REASON_LABELS, type FollowupReason } from "@/lib/alumni-query";

export const dynamic = "force-dynamic";

const AFFILIATIONS = ["Alum", "Friend", "Parent", "Alum | Friend", "Alum | Parent"] as const;

type AlumRecord = {
  id: number;
  submitted_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  mobile: string | null;
  linkedin_url: string | null;
  origin: string | null;
  uwc_college: string | null;
  uwc_college_raw: string | null;
  grad_year: number | null;
  grad_year_raw: string | null;
  current_city: string | null;
  region: string | null;
  affiliation: string | null;
  company: string | null;
  help_tags: string | null;
  national_committee: string | null;
  about: string | null;
  questions: string | null;
  studying: string | null;
  working: string | null;
  attended_event: boolean | null;
  moved_out: boolean | null;
  subscribed: boolean | null;
  unsubscribed_at: string | null;
  unsubscribe_reason: string | null;
  unsubscribe_note: string | null;
  sources: string[] | null;
  flags: string[] | null;
  imported_at: string | null;
  updated_at: string | null;
  photo_url: string | null;
  // LinkedIn enrichment
  linkedin_alternate_email: string | null;
  headline: string | null;
  linkedin_about: string | null;
  location_full: string | null;
  location_city: string | null;
  location_country: string | null;
  current_title: string | null;
  current_company: string | null;
  current_company_id: string | null;
  current_company_linkedin: string | null;
  current_company_industry: string | null;
  current_company_size: string | null;
  current_company_website: string | null;
  current_location: string | null;
  current_since: string | null;
  uwc_verified: boolean | null;
  uwc_school_matched: string | null;
  total_experience_years: string | number | null;
  first_role_year: number | null;
  enriched_at: string | null;
  enrichment_source: string | null;
  followup_reason: string | null;
  no_linkedin_confirmed: boolean | null;
};

async function updateAlumnus(id: number, formData: FormData) {
  "use server";
  const get = (k: string): string | null => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const getNum = (k: string): number | null => {
    const v = get(k);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const email = get("email");
  if (!email) throw new Error("Email is required");

  const uwcCollegeRaw = get("uwc_college_raw");
  const uwcCollegeChoice = get("uwc_college");
  const uwcCollege = uwcCollegeChoice ?? normalizeCollege(uwcCollegeRaw);

  const gradYearRaw = get("grad_year_raw");
  const gradYearDirect = getNum("grad_year");
  const gradYear =
    gradYearDirect ??
    parseGradYear(gradYearRaw, { pearson: isPearson(uwcCollege) });

  const currentCity = get("current_city");
  const regionChoice = get("region");
  const region = regionChoice ?? cityToRegion(currentCity);

  // Follow-up: checkbox gates the reason. Unchecked → clear reason.
  const needsFollowup = formData.get("needs_followup") === "on";
  const followupReasonRaw = get("followup_reason");
  const followupReason =
    needsFollowup && followupReasonRaw && FOLLOWUP_REASONS.includes(followupReasonRaw as FollowupReason)
      ? followupReasonRaw
      : null;

  await sql`
    UPDATE alumni SET
      first_name         = ${get("first_name")},
      last_name          = ${get("last_name")},
      email              = ${email.toLowerCase()},
      mobile             = ${get("mobile")},
      linkedin_url       = ${get("linkedin_url")},
      origin             = ${get("origin")},
      uwc_college        = ${uwcCollege},
      uwc_college_raw    = ${uwcCollegeRaw},
      grad_year          = ${gradYear},
      grad_year_raw      = ${gradYearRaw},
      current_city       = ${currentCity},
      region             = ${region},
      affiliation        = ${get("affiliation")},
      company            = ${get("company")},
      help_tags          = ${get("help_tags")},
      national_committee = ${get("national_committee")},
      about              = ${get("about")},
      questions          = ${get("questions")},
      studying           = ${get("studying")},
      working            = ${get("working")},
      attended_event     = ${formData.get("attended_event") === "on"},
      moved_out          = ${formData.get("moved_out") === "on"},
      followup_reason    = ${followupReason},
      no_linkedin_confirmed = ${formData.get("no_linkedin_confirmed") === "on"},
      updated_at         = NOW()
    WHERE id = ${id}
  `;
  revalidatePath(`/admin/alumni/${id}`);
  revalidatePath("/admin/alumni");
  redirect(`/admin/alumni/${id}?saved=1`);
}

export default async function AlumnusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();
  const rows = (await sql`SELECT * FROM alumni WHERE id = ${numericId}`) as AlumRecord[];
  if (rows.length === 0) notFound();
  const r = rows[0];
  const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;

  const emailHistory = (await sql`
    SELECT
      s.id, s.status, s.sent_at, s.opened_at, s.clicked_at, s.bounced_at, s.error,
      s.kind, c.id AS campaign_id, COALESCE(c.subject, s.subject) AS subject
    FROM email_sends s
    LEFT JOIN email_campaigns c ON c.id = s.campaign_id
    WHERE s.alumni_id = ${numericId}
    ORDER BY s.created_at DESC
  `) as {
    id: string;
    status: string;
    sent_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    bounced_at: string | null;
    error: string | null;
    kind: string | null;
    campaign_id: string | null;
    subject: string | null;
  }[];

  const update = updateAlumnus.bind(null, numericId);

  async function doResubscribe() {
    "use server";
    await resubscribe(numericId);
    revalidatePath(`/admin/alumni/${numericId}`);
    revalidatePath("/admin/alumni");
    redirect(`/admin/alumni/${numericId}?saved=1`);
  }

  return (
    <div className="max-w-[1000px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/alumni" className="text-[color:var(--muted)] hover:text-navy">
          ← Back to alumni
        </Link>
      </div>
      <div className="flex items-start gap-4 mb-6">
        {r.photo_url ? (
          <img
            src={r.photo_url}
            alt={name}
            className="w-20 h-20 rounded-full object-cover bg-ivory-2 border border-[color:var(--rule)] shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-ivory-2 border border-[color:var(--rule)] flex items-center justify-center text-[color:var(--muted)] text-xl font-sans font-bold shrink-0">
            {(r.first_name?.[0] ?? r.email[0] ?? "?").toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">{name}</h1>
            {r.uwc_verified === true && (
              <span
                title="LinkedIn education history includes UWC attendance"
                className="inline-flex items-center gap-1 text-[11px] tracking-[.12em] uppercase font-bold text-green-800 bg-green-50 border border-green-200 rounded-full px-2 py-0.5"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                UWC verified
              </span>
            )}
          </div>
          {r.headline && (
            <p className="text-[color:var(--navy-ink)] italic text-sm mb-1">{r.headline}</p>
          )}
          <p className="text-[color:var(--muted)] text-sm">
            Record #{r.id}
            {r.submitted_at ? ` · submitted ${fmtDate(r.submitted_at)}` : ""}
            {r.imported_at ? ` · imported ${fmtDate(r.imported_at)}` : ""}
            {r.updated_at ? ` · updated ${fmtDate(r.updated_at)}` : ""}
          </p>
        </div>
      </div>

      {saved && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          Saved.
        </div>
      )}

      {r.subscribed === false && (
        <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-600 rounded-[2px] text-sm">
          <div className="font-semibold text-red-900 mb-1">Unsubscribed</div>
          <div className="text-red-900/80">
            {r.unsubscribed_at ? `On ${fmtDate(r.unsubscribed_at)}` : "Date unknown"}
            {" · "}Reason: {reasonLabel(r.unsubscribe_reason)}
            {r.unsubscribe_note ? <><br />Note: <span className="italic">{r.unsubscribe_note}</span></> : null}
          </div>
          <form action={doResubscribe} className="mt-3">
            <button
              type="submit"
              className="bg-navy text-white px-4 py-2 rounded text-xs font-semibold tracking-wide"
            >
              Resubscribe
            </button>
          </form>
        </div>
      )}

      <form action={update} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 space-y-6">
        <Section title="Identity">
          <Grid>
            <Field label="First name" name="first_name" defaultValue={r.first_name} />
            <Field label="Last name" name="last_name" defaultValue={r.last_name} />
            <Field label="Email" name="email" type="email" defaultValue={r.email} required />
            <Field label="Mobile" name="mobile" defaultValue={r.mobile} />
            <Field
              label="LinkedIn URL"
              name="linkedin_url"
              defaultValue={r.linkedin_url}
              labelAddon={
                r.linkedin_url ? (
                  <a
                    href={r.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open LinkedIn profile"
                    title="Open LinkedIn profile"
                    className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm bg-[#0A66C2] text-white text-[10px] font-bold hover:brightness-110 normal-case tracking-normal"
                  >
                    in
                  </a>
                ) : null
              }
            />
            <SelectField label="Affiliation" name="affiliation" defaultValue={r.affiliation} options={[{ value: "", label: "—" }, ...AFFILIATIONS.map((a) => ({ value: a, label: a }))]} />
          </Grid>
          <label className="flex items-start gap-2 text-sm mt-3">
            <input
              type="checkbox"
              name="no_linkedin_confirmed"
              defaultChecked={r.no_linkedin_confirmed ?? false}
              className="mt-0.5"
            />
            <span>
              Verified: no LinkedIn profile available
              <span className="block text-xs text-[color:var(--muted)]">
                I&rsquo;ve looked and this person doesn&rsquo;t have a discoverable public LinkedIn.
                Untick if unsure.
              </span>
            </span>
          </label>
        </Section>

        <Section title="UWC">
          <Grid>
            <SelectField
              label="College (canonical)"
              name="uwc_college"
              defaultValue={r.uwc_college}
              options={[{ value: "", label: "— (auto from raw)" }, ...COLLEGES.map((c) => ({ value: c.canonical, label: c.short }))]}
            />
            <Field label="College (as entered)" name="uwc_college_raw" defaultValue={r.uwc_college_raw} />
            <Field label="Grad year (canonical)" name="grad_year" type="number" defaultValue={r.grad_year?.toString() ?? null} />
            <Field label="Grad year (as entered)" name="grad_year_raw" defaultValue={r.grad_year_raw} />
            <Field label="Origin (country)" name="origin" defaultValue={r.origin} />
            <Field label="National committee (volunteer role)" name="national_committee" defaultValue={r.national_committee} />
          </Grid>
        </Section>

        <Section title="Location">
          <Grid>
            <Field label="Current city" name="current_city" defaultValue={r.current_city} />
            <SelectField
              label="Region (canonical)"
              name="region"
              defaultValue={r.region}
              options={[{ value: "", label: "— (auto from city)" }, ...REGIONS.map((x) => ({ value: x, label: x }))]}
            />
          </Grid>
        </Section>

        <Section title="Work & study">
          <Grid>
            <Field label="Company" name="company" defaultValue={r.company} />
            <Field label="Working (free text)" name="working" defaultValue={r.working} />
            <Field label="Studying" name="studying" defaultValue={r.studying} full />
          </Grid>
        </Section>

        <Section title="Other">
          <Grid>
            <Field label="How would you like to help? (tags)" name="help_tags" defaultValue={r.help_tags} full />
            <Textarea label="Something about you (self-reported)" name="about" defaultValue={r.about} />
            <Textarea label="Any questions?" name="questions" defaultValue={r.questions} />
          </Grid>
        </Section>

        {hasAnyLinkedInData(r) && (
          <Section title="LinkedIn — current role">
            {r.current_title || r.current_company ? (
              <Grid>
                <ReadOnly label="Title" value={r.current_title} />
                <ReadOnly
                  label="Company"
                  value={r.current_company}
                  href={r.current_company_linkedin ?? undefined}
                />
                <ReadOnly label="Industry" value={r.current_company_industry} />
                <ReadOnly label="Company size" value={r.current_company_size} />
                <ReadOnly label="Started" value={formatMonthYear(r.current_since)} />
                <ReadOnly label="Location" value={r.current_location} />
                {r.current_company_website && (
                  <ReadOnly
                    label="Company website"
                    value={r.current_company_website}
                    href={r.current_company_website}
                    full
                  />
                )}
              </Grid>
            ) : (
              <p className="text-sm text-[color:var(--muted)] italic">
                No current role on their public LinkedIn profile.
              </p>
            )}
          </Section>
        )}

        {hasAnyLinkedInData(r) && (
          <Section title="LinkedIn — profile">
            <Grid>
              <ReadOnly label="Headline" value={r.headline} full />
              <ReadOnly
                label="LinkedIn location"
                value={r.location_full}
                hint="Parsed from their public profile; may differ from the self-reported city above."
                full
              />
              <ReadOnly label="Alternate email (from LinkedIn)" value={r.linkedin_alternate_email} />
              <ReadOnly
                label="Experience"
                value={
                  r.total_experience_years != null
                    ? `${Number(r.total_experience_years).toFixed(1)} years${
                        r.first_role_year ? ` · first role ${r.first_role_year}` : ""
                      }`
                    : null
                }
              />
              <ReadOnlyTextarea
                label="LinkedIn about"
                value={r.linkedin_about}
                full
              />
              {r.uwc_school_matched && (
                <ReadOnly label="UWC match (LinkedIn)" value={r.uwc_school_matched} full />
              )}
            </Grid>
          </Section>
        )}

        <Section title="Engagement">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="attended_event" defaultChecked={r.attended_event ?? false} />
              Attended a past event
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="moved_out" defaultChecked={r.moved_out ?? false} />
              No longer in the Bay Area (hide from default search)
            </label>
          </div>
        </Section>

        <Section title="Follow-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="needs_followup"
                defaultChecked={!!r.followup_reason}
              />
              Needs follow-up
            </label>
            <select
              name="followup_reason"
              defaultValue={r.followup_reason ?? ""}
              className="border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white sm:min-w-[220px]"
            >
              <option value="">— reason —</option>
              {FOLLOWUP_REASONS.map((v) => (
                <option key={v} value={v}>
                  {FOLLOWUP_REASON_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            Uncheck to clear. Filter the search page by &ldquo;Follow-up&rdquo; to work through the queue.
          </p>
        </Section>

        <div className="flex items-center justify-between pt-4 border-t border-[color:var(--rule)]">
          <div className="text-[11px] tracking-[.22em] uppercase text-[color:var(--muted)]">
            Sources: {sourcesLabel(r.sources, r.enrichment_source)}
            {r.flags?.length ? ` · flags: ${r.flags.join(", ")}` : ""}
            {r.enriched_at && (
              <span className="ml-3 normal-case tracking-normal text-[11px]">
                Last enriched {fmtDate(r.enriched_at)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold">
              Save changes
            </button>
          </div>
        </div>
      </form>

      {emailHistory.length > 0 && (
        <section className="mt-8 bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
          <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-5 py-4 border-b border-[color:var(--rule)]">
            Email history ({emailHistory.length})
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-4 py-2">Subject</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Sent</th>
                <th className="text-left px-4 py-2">Opened</th>
                <th className="text-left px-4 py-2">Clicked</th>
              </tr>
            </thead>
            <tbody>
              {emailHistory.map((h) => (
                <tr key={h.id} className="border-t border-[color:var(--rule)]">
                  <td className="px-4 py-2">
                    {h.campaign_id ? (
                      <Link href={`/admin/email/${h.campaign_id}`} className="text-navy hover:underline">
                        {h.subject ?? "(untitled)"}
                      </Link>
                    ) : (
                      <span className="text-[color:var(--navy-ink)]">{h.subject ?? "(untitled)"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-[10px] uppercase tracking-wider ${
                        h.status === "sent"
                          ? "text-green-800"
                          : h.status === "bounced"
                            ? "text-red-700"
                            : h.status === "failed"
                              ? "text-red-700"
                              : "text-[color:var(--muted)]"
                      }`}
                    >
                      {h.status}
                    </span>
                    {h.error ? (
                      <span className="ml-2 text-[10px] text-red-700">({h.error})</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {h.sent_at ? fmtDate(h.sent_at) : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {h.opened_at ? fmtDate(h.opened_at) : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {h.clicked_at ? fmtDate(h.clicked_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function hasAnyLinkedInData(r: AlumRecord): boolean {
  return !!(
    r.headline ||
    r.linkedin_about ||
    r.current_title ||
    r.current_company ||
    r.location_full ||
    r.linkedin_alternate_email ||
    r.total_experience_years ||
    r.enriched_at
  );
}

function formatMonthYear(v: string | null | undefined): string | null {
  // Enrichment stores "M-YYYY" (e.g. "2-2024"). Render as "February 2024".
  if (!v) return null;
  const m = /^(\d{1,2})-(\d{4})$/.exec(v);
  if (!m) return v;
  const month = Number(m[1]);
  const year = m[2];
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  if (month < 1 || month > 12) return v;
  return `${names[month - 1]} ${year}`;
}

function sourcesLabel(sources: string[] | null, enrichmentSource: string | null): string {
  const parts: string[] = sources ?? [];
  if (enrichmentSource && !parts.some((p) => p.toLowerCase().includes("linkedin"))) {
    parts.push("LINKEDIN_ENRICHMENT");
  }
  return parts.length > 0 ? parts.join(", ") : "No source tagged";
}

function ReadOnly({
  label, value, href, hint, full,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
  hint?: string;
  full?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={`${full ? "sm:col-span-2" : ""}`}>
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
      </div>
      <div className="text-sm text-[color:var(--navy-ink)] bg-ivory-2 border border-[color:var(--rule)] rounded px-3 py-2 min-h-[2.25rem]">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-navy hover:underline break-all">
            {value}
          </a>
        ) : (
          value
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-[color:var(--muted)]">{hint}</div>}
    </div>
  );
}

function ReadOnlyTextarea({
  label, value, full,
}: {
  label: string;
  value: string | null | undefined;
  full?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={`${full ? "sm:col-span-2" : ""}`}>
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
      </div>
      <div className="text-sm text-[color:var(--navy-ink)] bg-ivory-2 border border-[color:var(--rule)] rounded px-3 py-2 whitespace-pre-wrap leading-relaxed max-h-[260px] overflow-auto">
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label, name, defaultValue, type = "text", required, full, labelAddon,
}: {
  label: string; name: string; defaultValue?: string | null; type?: string; required?: boolean; full?: boolean;
  labelAddon?: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="flex items-center gap-2 text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        <span>{label}</span>
        {labelAddon}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function SelectField({
  label, name, defaultValue, options,
}: {
  label: string; name: string; defaultValue?: string | null; options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) {
  return (
    <label className="block sm:col-span-2">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={3}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}
