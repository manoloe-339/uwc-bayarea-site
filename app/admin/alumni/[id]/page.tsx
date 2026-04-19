import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { COLLEGES, normalizeCollege, isPearson } from "@/lib/uwc-colleges";
import { parseGradYear } from "@/lib/gradyear";
import { cityToRegion, REGIONS } from "@/lib/region";

export const dynamic = "force-dynamic";

const AFFILIATIONS = ["Alum", "Friend", "Parent", "Alum | Friend", "Alum | Parent"] as const;

type AlumRecord = {
  id: number;
  submitted_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  mobile: string | null;
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
      updated_at         = NOW()
    WHERE id = ${id}
  `;
  revalidatePath(`/admin/alumni/${id}`);
  revalidatePath("/admin/alumni");
  redirect(`/admin/alumni/${id}?saved=1`);
}

async function deleteAlumnus(id: number) {
  "use server";
  await sql`DELETE FROM alumni WHERE id = ${id}`;
  revalidatePath("/admin/alumni");
  redirect("/admin/alumni?deleted=1");
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

  const update = updateAlumnus.bind(null, numericId);
  const del = deleteAlumnus.bind(null, numericId);

  return (
    <div className="max-w-[1000px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/alumni" className="text-[color:var(--muted)] hover:text-navy">
          ← Back to alumni
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">{name}</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Record #{r.id} · imported {r.imported_at ? new Date(r.imported_at).toLocaleDateString() : "—"}
        {r.updated_at ? ` · updated ${new Date(r.updated_at).toLocaleDateString()}` : ""}
      </p>

      {saved && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          Saved.
        </div>
      )}

      <form action={update} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 space-y-6">
        <Section title="Identity">
          <Grid>
            <Field label="First name" name="first_name" defaultValue={r.first_name} />
            <Field label="Last name" name="last_name" defaultValue={r.last_name} />
            <Field label="Email" name="email" type="email" defaultValue={r.email} required />
            <Field label="Mobile" name="mobile" defaultValue={r.mobile} />
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
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="attended_event" defaultChecked={r.attended_event ?? false} />
            Attended a past event
          </label>
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

      <form action={del} className="mt-6">
        <button
          type="submit"
          className="text-xs text-red-700 hover:underline"
          formNoValidate
        >
          Delete this record
        </button>
      </form>
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
