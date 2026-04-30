"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PreviewStatus = "finalized" | "fix" | "pending";

type Props = {
  slug: string;
  initialSubject: string | null;
  initialHeading: string | null;
  initialBody: string | null;
  defaults: {
    subject: string;
    heading: string;
    body: string;
  };
  sampleVars: {
    name: string;
    event: string;
    date: string;
    time: string;
    location: string;
    amount: string;
  };
};

function interpolate(template: string, vars: Props["sampleVars"]): string {
  return template.replace(
    /\{(name|event|date|time|location|amount)\}/g,
    (_, k: keyof Props["sampleVars"]) => vars[k] ?? ""
  );
}

export function ReminderCopyEditor({
  slug,
  initialSubject,
  initialHeading,
  initialBody,
  defaults,
  sampleVars,
}: Props) {
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [heading, setHeading] = useState(initialHeading ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("finalized");
  const [, startTransition] = useTransition();
  const router = useRouter();

  const effectiveSubject = (subject.trim() || defaults.subject);
  const effectiveHeading = (heading.trim() || defaults.heading);
  const effectiveBody = (body.trim() || defaults.body);

  const previewSubject = useMemo(
    () => interpolate(effectiveSubject, sampleVars),
    [effectiveSubject, sampleVars]
  );
  const previewHeading = useMemo(
    () => interpolate(effectiveHeading, sampleVars),
    [effectiveHeading, sampleVars]
  );
  const previewBody = useMemo(
    () => interpolate(effectiveBody, sampleVars),
    [effectiveBody, sampleVars]
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/ticket-events/${slug}/reminder-copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim() || null,
          heading: heading.trim() || null,
          body: body.trim() || null,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setSubject("");
    setHeading("");
    setBody("");
  };

  return (
    <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
          Reminder email copy
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          Placeholders:{" "}
          <code className="font-mono bg-ivory-2 px-1 rounded">{`{name}`}</code>{" "}
          <code className="font-mono bg-ivory-2 px-1 rounded">{`{event}`}</code>{" "}
          <code className="font-mono bg-ivory-2 px-1 rounded">{`{date}`}</code>{" "}
          <code className="font-mono bg-ivory-2 px-1 rounded">{`{time}`}</code>{" "}
          <code className="font-mono bg-ivory-2 px-1 rounded">{`{location}`}</code>{" "}
          <code className="font-mono bg-ivory-2 px-1 rounded">{`{amount}`}</code>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Field
            label="Subject"
            value={subject}
            onChange={setSubject}
            placeholder={defaults.subject}
          />
          <Field
            label="Heading"
            value={heading}
            onChange={setHeading}
            placeholder={defaults.heading}
          />
          <Field
            label="Body (between greeting and event details)"
            value={body}
            onChange={setBody}
            placeholder={defaults.body}
            textarea
            rows={5}
          />
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={revert}
              className="text-sm text-[color:var(--muted)] hover:text-navy"
            >
              Reset to defaults
            </button>
            {saved && <span className="text-sm text-green-700">Saved ✓</span>}
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            Leave a field blank to use the default. Blank line separates paragraphs.
          </p>
        </div>

        <div className="bg-ivory-2 border border-[color:var(--rule)] rounded-[8px] p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-[10px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
              Preview (sample data)
            </div>
            <div className="inline-flex rounded-full border border-[color:var(--rule)] bg-white p-0.5 text-[10px] tracking-[.14em] uppercase font-bold">
              <PreviewTabBtn
                active={previewStatus === "finalized"}
                onClick={() => setPreviewStatus("finalized")}
                activeCls="bg-emerald-600 text-white"
              >
                Finalized
              </PreviewTabBtn>
              <PreviewTabBtn
                active={previewStatus === "fix"}
                onClick={() => setPreviewStatus("fix")}
                activeCls="bg-rose-600 text-white"
              >
                Fix
              </PreviewTabBtn>
              <PreviewTabBtn
                active={previewStatus === "pending"}
                onClick={() => setPreviewStatus("pending")}
                activeCls="bg-amber-600 text-white"
              >
                Pending
              </PreviewTabBtn>
            </div>
          </div>
          <div className="text-xs text-[color:var(--muted)] mb-2 break-words">
            <span className="font-semibold">Subject:</span> {previewSubject}
          </div>
          <div className="bg-white border border-[color:var(--rule)] rounded-[8px] p-4 text-sm leading-relaxed">
            <h3 className="font-sans font-bold text-navy text-lg mb-2">
              {previewHeading}
            </h3>
            <p className="mb-2">Hi {sampleVars.name},</p>
            {previewBody
              .split(/\n{2,}/g)
              .filter((p) => p.trim())
              .map((p, i) => (
                <p key={i} className="mb-2 whitespace-pre-wrap">{p}</p>
              ))}
            <div className="bg-ivory-2 border border-[color:var(--rule)] rounded p-3 my-3 text-xs leading-relaxed">
              <div>
                <strong>When:</strong> {sampleVars.date}
                {sampleVars.time ? ` at ${sampleVars.time}` : ""}
              </div>
              {sampleVars.location && (
                <div><strong>Where:</strong> {sampleVars.location}</div>
              )}
              <div><strong>Ticket:</strong> {sampleVars.amount}</div>
            </div>
            <NameTagPreviewBlock status={previewStatus} sampleName={sampleVars.name} />
            <p className="font-semibold text-navy">Your QR code for fast check-in</p>
            <div className="text-center py-4 text-[color:var(--muted)] text-xs">
              [QR code image]
            </div>
            <p className="text-xs text-[color:var(--muted)]">Looking forward to seeing you.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewTabBtn({
  active,
  onClick,
  activeCls,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeCls: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full transition-colors ${
        active ? activeCls : "text-[color:var(--muted)] hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Mirrors the three branches in lib/attendee-reminder.ts so the editor
 * preview shows what each recipient actually sees based on the
 * finalization status of their name tag.
 */
function NameTagPreviewBlock({
  status,
  sampleName,
}: {
  status: PreviewStatus;
  sampleName: string;
}) {
  if (status === "finalized") {
    const parts = sampleName.trim().split(/\s+/);
    const first = parts[0] ?? "Alex";
    const last = parts.slice(1).join(" ") || "Doe";
    return (
      <div
        className="my-3 rounded p-4 text-center"
        style={{ background: "#FFFFFF", border: "2px dashed #B5A88B" }}
      >
        <div className="text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-2">
          At the door, we&rsquo;ll have a tag for
        </div>
        <div className="font-display font-bold text-[color:var(--navy-ink)] text-xl leading-tight">
          {first} {last}
        </div>
        <div className="text-sm text-navy font-semibold mt-1">UWCSEA · 2007</div>
        <div className="text-[11px] text-[color:var(--muted)] mt-3">
          Want it different? Just reply to this email.
        </div>
      </div>
    );
  }
  if (status === "fix") {
    return (
      <div
        className="my-3 rounded text-xs"
        style={{ background: "#FFF7ED", borderLeft: "4px solid #F59E0B", padding: "10px 14px" }}
      >
        <strong style={{ color: "#92400E" }}>We&rsquo;re confirming your name tag.</strong>
        <span style={{ color: "#92400E" }}>
          {" "}
          Please reply with the name and UWC affiliation (college + grad year)
          you&rsquo;d like printed on your badge.
        </span>
      </div>
    );
  }
  // pending
  return (
    <div className="my-3 text-[12px] text-[color:var(--muted)] italic">
      If you&rsquo;d like a specific name or UWC affiliation on your badge,
      reply to this email and we&rsquo;ll print it for you.
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows ?? 4}
          className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-sans"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
        />
      )}
    </label>
  );
}
