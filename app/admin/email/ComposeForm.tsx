"use client";

import { useActionState, useState, useTransition } from "react";
import { sendTest, sendToAll, type SendTestResult } from "./actions";
import type { AlumniFilters } from "@/lib/alumni-query";

export default function ComposeForm({
  recipientCount,
  filters,
}: {
  recipientCount: number;
  filters: AlumniFilters;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [salutation, setSalutation] = useState("Hi");
  const [includeFirstName, setIncludeFirstName] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, startSending] = useTransition();
  const [testState, testAction] = useActionState<SendTestResult | null, FormData>(sendTest, null);

  const disabled = !subject.trim() || !body.trim();

  const previewSalutation = (() => {
    const sal = salutation.trim();
    if (!sal) return "";
    const name = includeFirstName ? " Manolo" : "";
    return `${sal}${name},`;
  })();

  return (
    <div className="space-y-6">
      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-4">Message</h2>
        <label className="block mb-4">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            placeholder="e.g. UWC Bay Area meetup · Friday May 1"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end mb-4">
          <label className="block">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">Salutation</span>
            <input
              value={salutation}
              onChange={(e) => setSalutation(e.target.value)}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
              placeholder="Hi"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[color:var(--navy-ink)] pb-2.5">
            <input
              type="checkbox"
              checked={includeFirstName}
              onChange={(e) => setIncludeFirstName(e.target.checked)}
            />
            Include first name
          </label>
        </div>
        <p className="mb-4 text-xs text-[color:var(--muted)]">
          Preview per recipient: <span className="font-mono bg-ivory-2 px-2 py-0.5 rounded">{previewSalutation || "(no salutation)"}</span>
          {" "}
          <span className="italic">(if a record has no first name, we fall back to "there")</span>
        </p>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">Body (plain text — line breaks preserved, URLs auto-linked)</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-sans"
            placeholder={"We're hosting a casual gathering on Friday May 1..."}
          />
        </label>
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Every email gets the UWC Bay Area footer + a personalized unsubscribe link.
        </p>
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">Send a test</h2>
        <form action={testAction} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="body" value={body} />
          <input type="hidden" name="salutation" value={salutation} />
          <input type="hidden" name="includeFirstName" value={includeFirstName ? "1" : ""} />
          <label className="flex-1 block">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">Test recipient</span>
            <input
              type="email"
              name="to"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
              placeholder="manoloe@gmail.com"
            />
          </label>
          <button
            type="submit"
            disabled={disabled || !testTo}
            className="bg-navy text-white px-4 py-2.5 rounded text-sm font-semibold disabled:opacity-50 h-[38px]"
          >
            Send test
          </button>
        </form>
        {testState?.ok && (
          <div className="mt-3 text-sm text-green-800">
            Test sent ✓ <span className="text-[color:var(--muted)] text-xs">id: {testState.id}</span>
          </div>
        )}
        {testState && !testState.ok && (
          <div className="mt-3 text-sm text-red-700">Failed: {testState.error}</div>
        )}
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">Send to all recipients</h2>
          <span className="text-[11px] tracking-[.22em] uppercase text-[color:var(--muted)]">
            {recipientCount} subscribed · excludes unsubscribed
          </span>
        </div>
        {!confirming ? (
          <button
            type="button"
            disabled={disabled || recipientCount === 0}
            onClick={() => setConfirming(true)}
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
          >
            Send to {recipientCount} recipients…
          </button>
        ) : (
          <form
            action={(fd) => {
              fd.set("subject", subject);
              fd.set("body", body);
              fd.set("salutation", salutation);
              fd.set("includeFirstName", includeFirstName ? "1" : "");
              fd.set("filters", JSON.stringify(filters));
              startSending(() => sendToAll(fd));
            }}
            className="p-4 bg-ivory-2 border-l-4 border-navy rounded-[2px]"
          >
            <p className="text-sm mb-3">
              You're about to send to <strong>{recipientCount}</strong> recipients. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={sending}
                className="bg-red-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
              >
                {sending ? "Sending…" : "Yes, send to all"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
