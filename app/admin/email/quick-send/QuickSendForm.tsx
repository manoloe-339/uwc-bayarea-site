"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { sendQuickList, type QuickSendResult } from "./actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function quickParse(raw: string): { valid: string[]; invalid: string[]; duplicates: number } {
  const tokens = raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  for (const t of tokens) {
    const lc = t.toLowerCase();
    if (seen.has(lc)) {
      duplicates++;
      continue;
    }
    seen.add(lc);
    if (EMAIL_RE.test(t)) valid.push(lc);
    else invalid.push(t);
  }
  return { valid, invalid, duplicates };
}

export default function QuickSendForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [salutation, setSalutation] = useState("Hi");
  const [includeFirstName, setIncludeFirstName] = useState(true);
  const [emails, setEmails] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<QuickSendResult | null, FormData>(
    sendQuickList,
    null
  );

  const parsed = useMemo(() => quickParse(emails), [emails]);
  const canSend =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    parsed.valid.length > 0 &&
    !pending;

  if (state?.ok) {
    return (
      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6">
        <h2 className="font-sans text-xl font-bold text-[color:var(--navy-ink)] mb-3">
          Sent
        </h2>
        <p className="text-sm text-[color:var(--navy-ink)] mb-4">
          {state.sent} delivered · {state.failed} failed · {state.matched} matched to
          alumni · {state.unmatched} non-DB recipients
          {state.unsubscribed > 0 && ` · ${state.unsubscribed} skipped (unsubscribed)`}
          {state.invalid > 0 && ` · ${state.invalid} invalid skipped`}
        </p>
        <div className="flex gap-3">
          <Link
            href="/admin/email/campaigns"
            className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
          >
            View in Campaigns
          </Link>
          <Link
            href="/admin/email/quick-send"
            className="text-sm font-semibold text-[color:var(--muted)] hover:text-navy px-4 py-2"
          >
            Send another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-4">
          Message
        </h2>
        <label className="block mb-4">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
            Subject
          </span>
          <input
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end mb-4">
          <label className="block">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
              Salutation
            </span>
            <input
              name="salutation"
              value={salutation}
              onChange={(e) => setSalutation(e.target.value)}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm pb-2.5">
            <input
              type="checkbox"
              name="includeFirstName"
              checked={includeFirstName}
              onChange={(e) => setIncludeFirstName(e.target.checked)}
              className="accent-navy"
            />
            Include first name (alumni-matched only)
          </label>
        </div>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
            Body (plain text)
          </span>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-sans"
            placeholder="Hey — I'm reaching out because…"
          />
        </label>
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Each email gets the UWC Bay Area HTML wrapper + footer. Recipients
          matched to alumni get a personalized unsubscribe link; non-DB recipients
          get the manual unsubscribe page.
        </p>
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-4">
          Recipients
        </h2>
        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
            Paste emails (separated by commas, semicolons, spaces, or newlines)
          </span>
          <textarea
            name="emails"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={6}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-mono"
            placeholder="alice@example.com, bob@example.com"
          />
        </label>
        <div className="mt-3 text-xs text-[color:var(--muted)] space-y-0.5">
          <div>
            <strong className="text-[color:var(--navy-ink)]">{parsed.valid.length}</strong>{" "}
            valid email{parsed.valid.length === 1 ? "" : "s"}
            {parsed.duplicates > 0 && ` · ${parsed.duplicates} duplicate${parsed.duplicates === 1 ? "" : "s"} removed`}
            {parsed.invalid.length > 0 && ` · ${parsed.invalid.length} invalid skipped`}
          </div>
          {parsed.invalid.length > 0 && (
            <div className="text-rose-700">
              Invalid: {parsed.invalid.slice(0, 5).join(", ")}
              {parsed.invalid.length > 5 && ` … (+${parsed.invalid.length - 5} more)`}
            </div>
          )}
          <div className="italic">
            On send, we look up each email in the alumni DB. Matched recipients use
            their first name + tracked unsubscribe link; non-matched recipients
            get the generic salutation. Unsubscribed alumni are auto-skipped.
          </div>
        </div>
      </section>

      {state && !state.ok && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-sm text-rose-900">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3">
        {!confirming ? (
          <button
            type="button"
            disabled={!canSend}
            onClick={() => setConfirming(true)}
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
          >
            Continue → ({parsed.valid.length})
          </button>
        ) : (
          <>
            <button
              type="submit"
              disabled={pending}
              className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Sending…" : `Send to ${parsed.valid.length} recipient${parsed.valid.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="text-sm text-[color:var(--muted)] hover:text-navy"
            >
              Cancel
            </button>
          </>
        )}
        <Link
          href="/admin/email/campaigns"
          className="ml-auto text-sm text-[color:var(--muted)] hover:text-navy"
        >
          ← Back to Campaigns
        </Link>
      </div>
    </form>
  );
}
