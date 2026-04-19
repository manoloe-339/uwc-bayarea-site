"use client";

import { useState, useTransition } from "react";
import { COLLEGES } from "@/lib/uwc-colleges";
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
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const showUwcFields = affiliation === "Alum";
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
      {/* Honeypot — hidden from real users, bots will fill it */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

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
            <SelectField label="College" name="uwc_college" required>
              <option value="">— Select —</option>
              {COLLEGES.map((c) => (
                <option key={c.canonical} value={c.canonical}>
                  {c.canonical}
                </option>
              ))}
            </SelectField>
            <Field
              label="Graduation year"
              name="grad_year"
              type="number"
              placeholder="e.g. 2015"
              required
              inputMode="numeric"
            />
          </Grid>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            Pearson College alumni: enter the 4-digit year (e.g. 2018 for PC43).
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
          <Field
            label="Origin (country, optional)"
            name="origin"
            placeholder="e.g. Brazil, or 'US'"
            full
          />
        </Grid>
      </Section>

      <Section title="Work & study (optional)">
        <Grid>
          <Field label="Company" name="company" placeholder="e.g. Google" />
          <Field label="Role / work" name="working" placeholder="e.g. Product manager" />
          <Field label="Studying" name="studying" full placeholder="e.g. Stanford MBA '26" />
        </Grid>
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
        <Field
          label="Do you currently volunteer on a National Committee? If so, which?"
          name="national_committee"
          placeholder="e.g. Polish NC"
          full
        />
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
}: {
  label: string; name: string; type?: string; required?: boolean; full?: boolean;
  placeholder?: string; autoComplete?: string; inputMode?: "numeric" | "tel" | "email" | "text";
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
