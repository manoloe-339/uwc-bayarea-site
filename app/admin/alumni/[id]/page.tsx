import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { COLLEGES, normalizeCollege, isPearson } from "@/lib/uwc-colleges";
import { parseGradYear } from "@/lib/gradyear";
import { cityToRegion, REGIONS } from "@/lib/region";
import { reasonLabel } from "@/lib/unsubscribe-reasons";
import { resubscribe } from "@/app/unsubscribe/actions";

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
      c.id AS campaign_id, c.subject
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
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">{name}</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Record #{r.id}
        {r.submitted_at ? ` · submitted ${new Date(r.submitted_at).toLocaleDateString()}` : ""}
        {r.imported_at ? ` · imported ${new Date(r.imported_at).toLocaleDateString()}` : ""}
        {r.updated_at ? ` · updated ${new Date(r.updated_at).toLocaleDateString()}` : ""}
      </p>

      {saved && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          Saved.
        </div>
      )}

      {r.subscribed === false && (
        <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-600 rounded-[2px] text-sm">
          <div className="font-semibold text-red-900 mb-1">Unsubscribed</div>
          <div className="text-red-900/80">
            {r.unsubscribed_at ? `On ${new Date(r.unsubscribed_at).toLocaleDateString()}` : "Date unknown"}
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
            <Field label="LinkedIn URL" name="linkedin_url" defaultValue={r.linkedin_url} />
            <SelectField label="Affiliation" name="affiliation" defaultValue={r.affiliation} options={[{ value: "", label: "—" }, ...AFFILIATIONS.map((a) => ({ value: a, label: a }))]} />
          </Grid>
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
            <Textarea label="Something about you" name="about" defaultValue={r.about} />
            <Textarea label="Any questions?" name="questions" defaultValue={r.questions} />
          </Grid>
        </Section>

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

        <div className="flex items-center justify-between pt-4 border-t border-[color:var(--rule)]">
          <div className="text-[11px] tracking-[.22em] uppercase text-[color:var(--muted)]">
            {r.sources?.length ? `Sources: ${r.sources.join(", ")}` : "No source tagged"}
            {r.flags?.length ? ` · flags: ${r.flags.join(", ")}` : ""}
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
                <th className="text-left px-4 py-2">Campaign</th>
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
                      <span className="text-[color:var(--muted)]">—</span>
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
                    {h.sent_at ? new Date(h.sent_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {h.opened_at ? new Date(h.opened_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {h.clicked_at ? new Date(h.clicked_at).toLocaleDateString() : "—"}
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
  label, name, defaultValue, type = "text", required, full,
}: {
  label: string; name: string; defaultValue?: string | null; type?: string; required?: boolean; full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">{label}</span>
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
