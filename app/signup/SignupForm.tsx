"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { COLLEGES, gradYearRangeFor } from "@/lib/uwc-colleges";
import { CountryAutocomplete } from "@/components/CountryAutocomplete";
import { submitSignup } from "./actions";
import { INITIAL_SIGNUP_STATE } from "./state";

type HelpOption = { value: string; label: string; hint?: string };

const HELP_OPTIONS: ReadonlyArray<HelpOption> = [
  { value: "Organize events", label: "Organize events" },
  {
    value: "Campus contact",
    label: "Campus contact",
    hint: "Berkeley, Stanford, Minerva, etc.",
  },
  { value: "Help with a National Committee", label: "Help with a National Committee" },
];

type Affiliation = "Alum" | "Friend" | "Parent";

type ContactField = "mobile" | "linkedin";

export default function SignupForm() {
  const [affiliation, setAffiliation] = useState<Affiliation | "">("");
  const [college, setCollege] = useState<string>("");
  const [parentCollege, setParentCollege] = useState<string>("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  // Modal shown when the user tries to submit without mobile or
  // linkedin. The modal explains why we ask, lets them enter a
  // value inline, or skip. We stash the FormData on submit so the
  // "Add / Skip" handlers can pick up exactly the payload the user
  // just tried to submit — no state races, no re-serialization.
  const [modalOpen, setModalOpen] = useState<ContactField | null>(null);
  const [modalValue, setModalValue] = useState("");
  const stashedFormData = useRef<FormData | null>(null);
  // useActionState lets the server action return validation errors
  // without redirecting, so the form keeps every field the user typed
  // when validation fails. Successful submissions still redirect.
  const [state, formAction, pending] = useActionState(
    submitSignup,
    INITIAL_SIGNUP_STATE,
  );

  // Scroll the error banner into view when a new error arrives so the
  // user notices it even if they're partway down the form.
  const errorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (state.error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state]);

  const yearRange = gradYearRangeFor(college);
  const yearOptions: number[] = yearRange
    ? Array.from({ length: yearRange.max - yearRange.min + 1 }, (_, i) => yearRange.min + i)
    : [];

  const parentYearRange = gradYearRangeFor(parentCollege);
  const parentYearOptions: number[] = parentYearRange
    ? Array.from({ length: parentYearRange.max - parentYearRange.min + 1 }, (_, i) => parentYearRange.min + i)
    : [];

  // Reused by alum and parent college dropdowns. c.short keeps option
  // labels narrow on mobile (e.g. "Atlantic" vs "UWC Atlantic College").
  const collegeOptions = COLLEGES.map((c) => ({
    value: c.canonical,
    label: c.short,
  }));

  const showUwcFields = affiliation === "Alum";
  const showParentFields = affiliation === "Parent";
  const showFriendFields = affiliation === "Friend";
  const emailsMatch =
    !confirmEmail || email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();

  /** Walk the submit-time gates for the contact fields. If mobile or
   * linkedin is empty AND hasn't been explicitly opted out of, stash
   * the FormData and open the corresponding modal. Otherwise, hand
   * off to the server action. Recursive-safe: the modal handlers
   * mutate the stashed FormData in place and re-enter this function. */
  function runSubmitGates(fd: FormData) {
    const mobileVal = String(fd.get("mobile") ?? "").trim();
    const noMobile = fd.get("no_mobile") === "on";
    if (!mobileVal && !noMobile) {
      stashedFormData.current = fd;
      setModalValue("");
      setModalOpen("mobile");
      return;
    }
    const linkedinVal = String(fd.get("linkedin_url") ?? "").trim();
    const noLinkedin = fd.get("no_linkedin") === "on";
    if (!linkedinVal && !noLinkedin) {
      stashedFormData.current = fd;
      setModalValue("");
      setModalOpen("linkedin");
      return;
    }
    formAction(fd);
  }

  function handleModalAdd() {
    const fd = stashedFormData.current;
    if (!fd || !modalOpen) return;
    const field = modalOpen === "mobile" ? "mobile" : "linkedin_url";
    fd.set(field, modalValue.trim());
    setModalOpen(null);
    setModalValue("");
    runSubmitGates(fd);
  }

  function handleModalSkip() {
    const fd = stashedFormData.current;
    if (!fd || !modalOpen) return;
    const flag = modalOpen === "mobile" ? "no_mobile" : "no_linkedin";
    fd.set(flag, "on");
    setModalOpen(null);
    setModalValue("");
    runSubmitGates(fd);
  }

  function handleModalCancel() {
    // User clicked the backdrop or the close (X). Discard the stashed
    // submit — they can fill in the field then click Sign me up again.
    stashedFormData.current = null;
    setModalOpen(null);
    setModalValue("");
  }

  return (
    <form
      action={(fd) => {
        if (!emailsMatch) return;
        runSubmitGates(fd);
      }}
      className="space-y-7"
      noValidate
    >
      {state.error && (
        <div
          ref={errorRef}
          role="alert"
          className="border border-red-300 bg-red-50 rounded-md px-4 py-3 text-sm text-red-800"
        >
          {state.error}
        </div>
      )}
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
              autoComplete="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
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
              Mobile *
            </span>
            <input
              name="mobile"
              type="tel"
              autoComplete="tel"
              placeholder="+1 415 555 0123"
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
            <span className="block mt-1 text-xs text-[color:var(--muted)]">
              Required for UWC Bay Area WhatsApp access.
            </span>
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
              LinkedIn profile URL *
            </span>
            <input
              name="linkedin_url"
              type="text"
              inputMode="url"
              placeholder="https://linkedin.com/in/yourname"
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
            <span className="block mt-1 text-xs text-[color:var(--muted)]">
              Helps us match you with alumni in the same field, industry, or company.
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

        {showUwcFields && (
          <div className="mt-5 space-y-4">
            <Grid>
              <SelectField
                label="College *"
                name="uwc_college"
                required
                value={college}
                onChange={setCollege}
                placeholder="— Select —"
                options={collegeOptions}
              />
              <SelectField
                label="Graduation year *"
                name="grad_year"
                required
                disabled={!college}
                key={college /* reset when college changes */}
                placeholder={college ? "— Select —" : "Pick a college first"}
                options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
              />
            </Grid>
            <CountryAutocomplete
              name="national_committee"
              label="Are you a volunteer with a National Committee?"
              placeholder="Type a country (e.g. Poland)"
              full
              hint="Pick the NC's country. Skip this if you don't volunteer on one."
            />
          </div>
        )}

        {showParentFields && (
          <div className="mt-5 space-y-4">
            <Field label="Student's name" name="parent_of_name" full />
            <Grid>
              <SelectField
                label="Their college"
                name="parent_of_uwc_college"
                value={parentCollege}
                onChange={setParentCollege}
                placeholder="— Select —"
                options={collegeOptions}
              />
              <SelectField
                label="Their graduation year"
                name="parent_of_grad_year"
                disabled={!parentCollege}
                key={parentCollege}
                placeholder={parentCollege ? "— Select —" : "Pick a college first"}
                options={parentYearOptions.map((y) => ({ value: String(y), label: String(y) }))}
              />
            </Grid>
          </div>
        )}

        {showFriendFields && (
          <div className="mt-5">
            <Field
              label="How did you hear about us?"
              name="how_heard"
              placeholder="e.g. through a friend, an event, social media…"
              full
            />
          </div>
        )}

        {affiliation && (
          <div className="mt-5">
            <CountryAutocomplete
              label="Origin (country)"
              name="origin"
              placeholder="Type a country (e.g. Brazil)"
              required
              full
              error={state.field === "origin" ? state.error : null}
            />
          </div>
        )}
      </Section>

      <Section title="Where you live now">
        <Field
          label="Current city"
          name="current_city"
          required
          placeholder="e.g. San Francisco"
          full
          autoComplete="address-level2"
        />
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
            <label key={opt.value} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="help"
                value={opt.value}
                className="mt-1"
              />
              <span>
                {opt.label}
                {opt.hint && (
                  <span className="block text-xs text-[color:var(--muted)]">
                    {opt.hint}
                  </span>
                )}
              </span>
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
          disabled={pending}
          className="bg-navy text-white px-6 py-3 rounded text-sm font-semibold tracking-wide disabled:opacity-50"
        >
          {pending ? "Sending…" : "Sign me up"}
        </button>
      </div>

      <ContactModal
        open={modalOpen}
        value={modalValue}
        onValueChange={setModalValue}
        onAdd={handleModalAdd}
        onSkip={handleModalSkip}
        onCancel={handleModalCancel}
      />
    </form>
  );
}

/** Modal shown on submit when the user left mobile or linkedin empty.
 * Each variant pitches the value of the field, offers an inline
 * input to add it right there, or a Skip button that submits without.
 * The Skip UX explicitly names what the user forfeits — WhatsApp
 * access for mobile, alumni-matching for linkedin — so the decision
 * is informed. */
function ContactModal({
  open, value, onValueChange, onAdd, onSkip, onCancel,
}: {
  open: ContactField | null;
  value: string;
  onValueChange: (v: string) => void;
  onAdd: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const copy =
    open === "mobile"
      ? {
          title: "Add your mobile number",
          body: "Without a mobile number you won't be eligible for the UWC Bay Area WhatsApp group — that's where most day-to-day chapter conversation happens.",
          placeholder: "+1 415 555 0123",
          inputType: "tel" as const,
          addLabel: "Add mobile & continue",
          skipLabel: "Skip — no WhatsApp",
        }
      : {
          title: "Add your LinkedIn profile",
          body: "We use LinkedIn to match you with alumni working in the same field, industry, or company — that's how the network becomes useful beyond the mailing list.",
          placeholder: "https://linkedin.com/in/yourname",
          inputType: "text" as const,
          addLabel: "Add LinkedIn & continue",
          skipLabel: "Skip — don't match me",
        };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      onClick={(e) => {
        // Backdrop click cancels. Inner clicks stopPropagation.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3
          id="contact-modal-title"
          className="text-lg font-bold text-navy mb-2"
        >
          {copy.title}
        </h3>
        <p className="text-sm text-[color:var(--muted)] mb-4 leading-relaxed">
          {copy.body}
        </p>
        <input
          type={copy.inputType}
          autoFocus
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={copy.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              e.preventDefault();
              onAdd();
            }
          }}
          className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white mb-4"
        />
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 rounded text-sm text-[color:var(--muted)] hover:bg-ivory-2"
          >
            {copy.skipLabel}
          </button>
          <button
            type="button"
            onClick={onAdd}
            disabled={!value.trim()}
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
          >
            {copy.addLabel}
          </button>
        </div>
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
  label,
  name,
  required,
  disabled,
  value,
  onChange,
  options,
  placeholder,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  /** Controlled value. Omit for uncontrolled (uses defaultValue=""). */
  value?: string;
  onChange?: (v: string) => void;
  /** When provided, renders <option> rows; can be used together with `placeholder`. */
  options?: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  /** Fallback for legacy callers passing raw <option> children. */
  children?: React.ReactNode;
}) {
  const labelStripped = label.replace(/\s*\*\s*$/, "");
  const isRequired = required || /\*\s*$/.test(label);
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {labelStripped}
        {isRequired ? " *" : ""}
      </span>
      <select
        name={name}
        required={isRequired}
        disabled={disabled}
        {...(value !== undefined
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue: "" })}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white disabled:bg-ivory-2 disabled:text-[color:var(--muted)]"
      >
        {options ? (
          <>
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </>
        ) : (
          children
        )}
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
