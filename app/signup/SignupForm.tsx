"use client";

import { useState, useTransition } from "react";
import { COLLEGES, gradYearRangeFor } from "@/lib/uwc-colleges";
import { CountryAutocomplete } from "@/components/CountryAutocomplete";
import { submitSignup } from "./actions";

const HELP_OPTIONS = [
  "Organize events",
  "Manage UWCx 501(c)(3)",
  "Campus contact (Berkeley, Stanford, Minerva, etc.)",
  "Communication & marketing",
  "Host / cook",
  "Introductions & fundraising",
  "Volunteer with a National Committee",
];

type Affiliation = "Alum" | "Friend" | "Parent";

export default function SignupForm() {
  const [affiliation, setAffiliation] = useState<Affiliation | "">("");
  const [college, setCollege] = useState<string>("");
  const [parentCollege, setParentCollege] = useState<string>("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const [pending, startTransition] = useTransition();

  const yearRange = gradYearRangeFor(college);
  const yearOptions: number[] = yearRange
    ? Array.from({ length: yearRange.max - yearRange.min + 1 }, (_, i) => yearRange.min + i)
    : [];

  const parentYearRange = gradYearRangeFor(parentCollege);
  const parentYearOptions: number[] = parentYearRange
    ? Array.from({ length: parentYearRange.max - parentYearRange.min + 1 }, (_, i) => parentYearRange.min + i)
    : [];

  const showUwcFields = affiliation === "Alum";
  const showParentFields = affiliation === "Parent";
  const emailsMatch =
    !confirmEmail || email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();
  const canSubmit = !pending && emailsMatch && !!email && !!confirmEmail;

  return (
    <form
      action={(fd) => {
        if (!emailsMatch) return;
        startTransition(() => submitSignup(fd));
      }}
      className="space-y-7"
      noValidate
    >
      {/* Honeypot — bots fill named fields; we hide it from humans
          (offscreen + opacity 0 + tabindex -1) and skip the label so
          nothing user-facing reads "Website". */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] top-[-9999px] w-px h-px opacity-0 pointer-events-none"
      />

      <Section title="About you">
        <Grid>
          <Field label="First name" name="first_name" required autoComplete="given-name" />
          <Field label="Last name" name="last_name" required autoComplete="family-name" />
          <label className="block sm:col-span-2">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
              Email *
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
              Confirm email *
            </span>
            <input
              type="email"
              required
              autoComplete="off"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              onPaste={(e) => {
                // Discourage paste so typos don't slip through both fields.
                e.preventDefault();
              }}
              className={`w-full border rounded px-3 py-2 text-sm bg-white ${
                emailsMatch ? "border-[color:var(--rule)]" : "border-red-500"
              }`}
            />
            {!emailsMatch && (
              <span className="block mt-1 text-xs text-red-600">
                The two email addresses don't match.
              </span>
            )}
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
              Mobile (optional)
            </span>
            <input
              name="mobile"
              type="tel"
              autoComplete="tel"
              placeholder="+1 415 555 0123"
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
            <span className="block mt-1 text-xs text-[color:var(--muted)]">
              We occasionally organize things via WhatsApp, so a mobile helps.
            </span>
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
              LinkedIn profile URL (optional, preferred)
            </span>
            <input
              name="linkedin_url"
              type="url"
              inputMode="url"
              placeholder="https://linkedin.com/in/yourname"
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
            <span className="block mt-1 text-xs text-[color:var(--muted)]">
              Helps us recognize you and connect alumni with similar backgrounds.
            </span>
          </label>
        </Grid>
      </Section>

      <Section title="Connection to UWC">
        <RadioGroup
          name="affiliation"
          value={affiliation}
          onChange={(v) => setAffiliation(v as Affiliation)}
          options={[
            { value: "Alum", label: "I'm a UWC alum" },
            { value: "Friend", label: "Friend of UWC" },
            { value: "Parent", label: "Parent of a UWC alum or student" },
          ]}
        />
      </Section>

      {showUwcFields && (
        <Section title="Which UWC?">
          <Grid>
            <label className="block">
              <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                College *
              </span>
              <select
                name="uwc_college"
                required
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
              >
                <option value="">— Select —</option>
                {COLLEGES.map((c) => (
                  <option key={c.canonical} value={c.canonical}>
                    {c.canonical}
                    {c.lastYear ? ` (closed ${c.lastYear})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                Graduation year *
              </span>
              <select
                name="grad_year"
                required
                disabled={!college}
                defaultValue=""
                key={college /* reset when college changes */}
                className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white disabled:bg-ivory-2 disabled:text-[color:var(--muted)]"
              >
                <option value="">{college ? "— Select —" : "Pick a college first"}</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </Grid>
          {college === "UWC Pearson College" && (
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Pearson alumni: pick the 4-digit year (e.g. 2018 for PC43).
            </p>
          )}
          <div className="mt-4">
            <CountryAutocomplete
              name="national_committee"
              label="Are you a volunteer with a National Committee?"
              placeholder="Type a country (e.g. Poland)"
              full
              hint="Pick the NC's country. Skip this if you don't volunteer on one."
            />
          </div>
        </Section>
      )}

      {showParentFields && (
        <Section title="About your UWC connection">
          <div className="mb-4">
            <Field
              label="Student's name"
              name="parent_of_name"
              placeholder="e.g. Mateo Espinosa"
              full
            />
          </div>
          <Grid>
            <label className="block">
              <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                Their college
              </span>
              <select
                name="parent_of_uwc_college"
                value={parentCollege}
                onChange={(e) => setParentCollege(e.target.value)}
                className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
              >
                <option value="">— Select —</option>
                {COLLEGES.map((c) => (
                  <option key={c.canonical} value={c.canonical}>
                    {c.canonical}
                    {c.lastYear ? ` (closed ${c.lastYear})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                Their graduation year
              </span>
              <select
                name="parent_of_grad_year"
                disabled={!parentCollege}
                defaultValue=""
                key={parentCollege}
                className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white disabled:bg-ivory-2 disabled:text-[color:var(--muted)]"
              >
                <option value="">{parentCollege ? "— Select —" : "Pick a college first"}</option>
                {parentYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </Grid>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            Helps us recognize you when their cohort hosts events.
          </p>
        </Section>
      )}

      <Section title="Where you are">
        <Grid>
          <Field
            label="Current city"
            name="current_city"
            required
            placeholder="e.g. San Francisco"
            full
            autoComplete="address-level2"
          />
          <CountryAutocomplete
            label="Origin (country, optional)"
            name="origin"
            placeholder="Type a country (e.g. Brazil)"
            full
          />
        </Grid>
      </Section>

      <Section title="Work & study (optional)">
        <div className="flex flex-wrap gap-5 mb-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isWorking}
              onChange={(e) => setIsWorking(e.target.checked)}
            />
            I'm currently working
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isStudying}
              onChange={(e) => setIsStudying(e.target.checked)}
            />
            I'm currently studying
          </label>
        </div>

        {isWorking && (
          <>
            <Grid>
              <Field label="Company" name="company" placeholder="best company ever" />
              <Field label="Role" name="working" placeholder="chief vibe officer" />
            </Grid>
            <div className="mt-4">
              <Field
                label="Where (city or remote)"
                name="work_location"
                placeholder="e.g. San Francisco, or 'Remote'"
                full
              />
            </div>
          </>
        )}
        {isStudying && (
          <Grid>
            <Field
              label="Where (school or city)"
              name="study_location"
              placeholder="e.g. UC Berkeley"
            />
            <Field
              label="What are you studying?"
              name="studying"
              placeholder="e.g. Comp Sci, MBA, etc."
            />
          </Grid>
        )}
      </Section>

      <Section title="How would you like to help? (optional)">
        <div className="grid gap-2 sm:grid-cols-2">
          {HELP_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="help"
                value={opt}
                className="mt-1"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Anything else? (optional)">
        <Textarea label="Something about you" name="about" />
        <Textarea label="Any questions for us?" name="questions" />
      </Section>

      <Section title="Stay in touch">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" defaultChecked required className="mt-1" />
          <span>
            I'd like to receive UWC Bay Area emails (event invites, alumni news).
            You can unsubscribe any time.
          </span>
        </label>
      </Section>

      <div className="pt-4 border-t border-[color:var(--rule)]">
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-navy text-white px-6 py-3 rounded text-sm font-semibold tracking-wide disabled:opacity-50"
        >
          {pending ? "Sending…" : "Sign me up"}
        </button>
      </div>
    </form>
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
  label, name, type = "text", required, full, placeholder, autoComplete, inputMode,
  min, max, step,
}: {
  label: string; name: string; type?: string; required?: boolean; full?: boolean;
  placeholder?: string; autoComplete?: string; inputMode?: "numeric" | "tel" | "email" | "text";
  min?: number | string; max?: number | string; step?: number | string;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}{required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        min={min}
        max={max}
        step={step}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function SelectField({
  label, name, required, children,
}: {
  label: string; name: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}{required ? " *" : ""}
      </span>
      <select
        name={name}
        required={required}
        defaultValue=""
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      >
        {children}
      </select>
    </label>
  );
}

function Textarea({ label, name }: { label: string; name: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">{label}</span>
      <textarea
        name={name}
        rows={3}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function RadioGroup({
  name, value, onChange, options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label key={o.value} className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1"
            required
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
