"use client";

import { useState, useTransition } from "react";
import { submitHelpOutAction } from "./actions";
import {
  VOLUNTEER_AREAS,
  type VolunteerArea,
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
  const [areas, setAreas] = useState<Areas>(EMPTY_AREAS);
  const [committee, setCommittee] = useState("");
  const [note, setNote] = useState("");
  const [submitting, startTransition] = useTransition();
  const [submitErr, setSubmitErr] = useState<string | null>(null);

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
    const selectedAreas = (Object.entries(areas) as [VolunteerArea, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k);
    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("email", email.trim());
    formData.set("areas", selectedAreas.join(","));
    formData.set("national_committee", committee.trim());
    formData.set("note", note.trim());
    startTransition(async () => {
      try {
        await submitHelpOutAction(formData);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Submit failed";
        // NEXT_REDIRECT is how Next.js signals a redirect from a server action — not a real error.
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
            Already in our directory? Great — we&rsquo;ll match you up.
            If not,{" "}
            <a
              href="/signup"
              className="text-navy underline font-semibold hover:opacity-80"
            >
              please sign up here
            </a>{" "}
            so we can stay in touch.
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
