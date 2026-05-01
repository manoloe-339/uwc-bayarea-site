"use client";

import { useEffect, useState, useTransition } from "react";
import { submitHelpOutAction } from "./actions";
import {
  VOLUNTEER_AREAS,
  type VolunteerArea,
  type AlumniLookupResult,
} from "@/lib/volunteer-signups-shared";

type Areas = Record<VolunteerArea, boolean>;
const EMPTY_AREAS: Areas = {
  national: false,
  outreach: false,
  events: false,
  donors: false,
  other: false,
};

export function HelpOutForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<{ status: "idle" | "checking" } | AlumniLookupResult>({
    status: "idle",
  });
  const [areas, setAreas] = useState<Areas>(EMPTY_AREAS);
  const [committee, setCommittee] = useState("");
  const [note, setNote] = useState("");
  const [submitting, startTransition] = useTransition();
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  useEffect(() => {
    if (!name.trim() && !email.trim()) {
      setLookup({ status: "idle" });
      return;
    }
    setLookup({ status: "checking" });
    const t = setTimeout(async () => {
      try {
        const url =
          `/api/alumni-lookup?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AlumniLookupResult;
        setLookup(data);
      } catch {
        setLookup({ status: "nomatch" });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [name, email]);

  const toggleArea = (id: VolunteerArea) => {
    setAreas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const anyArea = Object.values(areas).some(Boolean);
  const hasNameOrEmail = Boolean(name.trim() || email.trim());
  const validEmailIfPresent = !email.trim() || /.+@.+\..+/.test(email.trim());
  const canSubmit = hasNameOrEmail && validEmailIfPresent && anyArea && !submitting;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitErr(null);
    const matchedAlumniId =
      lookup.status === "match" && lookup.member ? lookup.member.id : null;
    const selectedAreas = (Object.entries(areas) as [VolunteerArea, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k);
    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("email", email.trim());
    formData.set("areas", selectedAreas.join(","));
    formData.set("national_committee", committee.trim());
    formData.set("note", note.trim());
    formData.set("matched_alumni_id", matchedAlumniId == null ? "" : String(matchedAlumniId));
    startTransition(async () => {
      try {
        await submitHelpOutAction(formData);
      } catch (err) {
        // Server action throws redirect on success, so anything here is a real error.
        const msg = err instanceof Error ? err.message : "Submit failed";
        // NEXT_REDIRECT is how Next.js signals a redirect from a server action.
        if (msg.includes("NEXT_REDIRECT")) return;
        setSubmitErr(msg);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="form-inner">
      <Step
        number="01"
        title="Tell us who you are"
        subtitle={
          <>
            We&rsquo;ll try to match you with our UWC Bay Area alumni database.
            If you haven&rsquo;t signed up yet,{" "}
            <a
              href="/signup"
              className="text-navy underline font-semibold hover:opacity-80"
            >
              please sign up here
            </a>
            .
          </>
        }
      >
        <div className="name-email-grid">
          <FormField label="Your name" htmlFor="ho-name">
            <input
              id="ho-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Alumni"
              autoComplete="name"
              className="text-input"
            />
          </FormField>
          <FormField label="Email address" htmlFor="ho-email">
            <input
              id="ho-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              autoComplete="email"
              className="text-input"
            />
          </FormField>
        </div>
        <LookupStatus lookup={lookup} />
      </Step>

      <Step
        number="02"
        title="Where would you like to help?"
        subtitle="Pick as many as you like. We'll match you with the right people."
      >
        <div className="grid gap-3">
          {VOLUNTEER_AREAS.map((a) => {
            const checked = areas[a.value];
            return (
              <button
                key={a.value}
                type="button"
                onClick={() => toggleArea(a.value)}
                className={`check-card text-left ${checked ? "checked" : ""}`}
              >
                <span className="box" aria-hidden="true">
                  {checked && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2.5 7.5l3 3 6-7"
                        stroke="#fff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <div>
                  <div className="label">{a.label}</div>
                  <div className="desc">{a.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Step>

      {areas.national && (
        <Step
          number="03"
          title="Which national committee?"
          subtitle="If there's a particular committee you'd like to work with, name it here. (Optional.)"
        >
          <input
            type="text"
            value={committee}
            onChange={(e) => setCommittee(e.target.value)}
            placeholder="e.g. UWC USA, UWC Atlantic, UWC Mahindra…"
            className="text-input"
          />
          <p className="field-help">
            You don&rsquo;t have to be a member of that national committee or
            come from that country &mdash; we welcome anyone interested in helping.
          </p>
        </Step>
      )}

      <Step
        number={areas.national ? "04" : "03"}
        title="Anything else we should know?"
        subtitle="A skill, an idea, time you can give. Whatever's relevant. (Optional.)"
      >
        <textarea
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="I'd love to help with photography at events, and I'm a graphic designer if that's useful…"
          className="text-input"
          style={{ resize: "vertical", minHeight: 110, fontFamily: "Inter", lineHeight: 1.55 }}
        />
      </Step>

      <div className="submit-row">
        <div
          className="text-[13px] leading-[1.5] max-w-[380px]"
          style={{ color: "var(--muted)" }}
        >
          {!canSubmit && !submitting && (
            <span>
              {!hasNameOrEmail
                ? "Add your name or email and pick at least one area to continue."
                : !validEmailIfPresent
                  ? "That email doesn't look right."
                  : !anyArea
                    ? "Pick at least one area to continue."
                    : ""}
            </span>
          )}
          {canSubmit && <span>Looks good. We&rsquo;ll be in touch.</span>}
          {submitErr && <span style={{ color: "#B8341F" }}>{submitErr}</span>}
        </div>
        <button type="submit" className="submit-btn" disabled={!canSubmit}>
          {submitting ? "Sending…" : "Send it in"}
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <path
              d="M1 7h16m-6-6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}

function Step({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="step-grid">
      <div className="step-num">{number}</div>
      <div>
        <h2
          className="font-display font-semibold text-[color:var(--navy-ink)] m-0"
          style={{
            fontSize: "clamp(22px, 5vw, 28px)",
            lineHeight: 1.15,
            letterSpacing: "-.01em",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="font-sans"
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--muted)",
              margin: "8px 0 20px",
              maxWidth: 580,
            }}
          >
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function LookupStatus({
  lookup,
}: {
  lookup: { status: "idle" | "checking" } | AlumniLookupResult;
}) {
  if (lookup.status === "idle") return null;
  if (lookup.status === "checking") {
    return (
      <div className="lookup-pill checking">
        <span className="lookup-dot" />
        Checking the database…
      </div>
    );
  }
  if (lookup.status === "match" && lookup.member) {
    const initials = lookup.member.name
      .split(/\s+/)
      .map((s) => s[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const sub = [lookup.member.school, lookup.member.year]
      .filter(Boolean)
      .join(" · ");
    return (
      <div
        className="mt-3 flex items-center gap-3 flex-wrap"
        style={{
          padding: "16px 18px",
          background: "rgba(2,101,168,.06)",
          borderLeft: "3px solid var(--navy)",
        }}
      >
        <span
          className="inline-flex items-center justify-center font-display italic font-semibold"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--navy)",
            color: "#fff",
            fontSize: 16,
          }}
        >
          {initials}
        </span>
        <div className="flex-1 min-w-[200px]">
          <div
            className="font-bold uppercase"
            style={{
              fontSize: 11,
              letterSpacing: ".22em",
              color: "var(--navy)",
            }}
          >
            Found you in our database
          </div>
          <div
            className="font-display font-semibold mt-1"
            style={{
              fontSize: 18,
              color: "var(--navy-ink)",
              textTransform: "capitalize",
            }}
          >
            {lookup.member.name}
            {sub && (
              <span
                style={{
                  fontStyle: "italic",
                  color: "var(--muted)",
                  fontWeight: 500,
                }}
              >
                {" "}
                &middot; {sub}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
  // nomatch
  return (
    <div
      className="mt-3"
      style={{
        padding: "16px 18px",
        background: "rgba(184,52,31,.06)",
        borderLeft: "3px solid #B8341F",
      }}
    >
      <div
        className="font-bold uppercase"
        style={{
          fontSize: 11,
          letterSpacing: ".22em",
          color: "#B8341F",
        }}
      >
        Not in our database yet
      </div>
      <div
        className="mt-1.5 font-sans"
        style={{
          fontSize: 14,
          color: "var(--navy-ink)",
          lineHeight: 1.5,
        }}
      >
        No problem &mdash; you can keep going. If you&rsquo;re a UWC alum,
        please{" "}
        <a
          href="/signup"
          className="text-navy underline font-semibold"
        >
          sign up to the directory
        </a>{" "}
        so we can find you next time.
      </div>
    </div>
  );
}
