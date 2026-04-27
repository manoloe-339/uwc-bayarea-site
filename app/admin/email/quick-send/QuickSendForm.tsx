"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { sendQuickList, type QuickSendResult } from "./actions";

// Find email-shaped substrings anywhere in the input.
const EMAIL_FIND_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

type ParsedRow = { email: string; parsedName: string | null; firstName: string | null };

function extractFirstName(name: string | null): string | null {
  if (!name) return null;
  const cleaned = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const firstWord = cleaned.split(" ")[0];
  if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-]*$/.test(firstWord)) return null;
  return firstWord;
}

function quickParse(raw: string): { rows: ParsedRow[]; duplicates: number } {
  const lines = raw.split(/\r?\n/);
  const seen = new Set<string>();
  const rows: ParsedRow[] = [];
  let prevNonEmpty: string | null = null;
  let duplicates = 0;

  for (const line of lines) {
    const matches = [...line.matchAll(EMAIL_FIND_RE)];
    if (matches.length === 0) {
      const trimmed = line.trim();
      prevNonEmpty = trimmed || null;
      continue;
    }
    for (const m of matches) {
      const email = m[0].toLowerCase();
      if (seen.has(email)) {
        duplicates++;
        continue;
      }
      seen.add(email);

      let nameText = line.slice(0, m.index ?? 0).trim();
      nameText = nameText.replace(/<\s*$/, "").replace(/[“”"']/g, "").trim();
      if (!nameText && prevNonEmpty) {
        nameText = prevNonEmpty.replace(/[“”"']/g, "").trim();
      }
      const parsedName = nameText || null;
      rows.push({ email, parsedName, firstName: extractFirstName(parsedName) });
    }
    prevNonEmpty = null;
  }
  return { rows, duplicates };
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
    parsed.rows.length > 0 &&
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
            Include first name (parsed from paste, or alumni record)
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
            <strong className="text-[color:var(--navy-ink)]">{parsed.rows.length}</strong>{" "}
            recipient{parsed.rows.length === 1 ? "" : "s"} found
            {parsed.duplicates > 0 && ` · ${parsed.duplicates} duplicate${parsed.duplicates === 1 ? "" : "s"} removed`}
          </div>
          <div className="italic">
            Names parsed from before/around each address. On send we also look up
            the alumni DB; the parsed name wins if present, otherwise the alumni
            first name fills in. Unsubscribed alumni are auto-skipped.
          </div>
        </div>

        {parsed.rows.length > 0 && (
          <div className="mt-3 border border-[color:var(--rule)] rounded-[10px] divide-y divide-[color:var(--rule)] max-h-72 overflow-y-auto">
            {parsed.rows.map((r) => {
              const greeting =
                includeFirstName && (r.firstName || "").length > 0
                  ? `${salutation.trim() || "Hi"} ${r.firstName},`
                  : `${salutation.trim() || "Hi"} there,`;
              return (
                <div
                  key={r.email}
                  className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[color:var(--navy-ink)] truncate">
                      {r.parsedName ?? <span className="italic text-[color:var(--muted)]">(no name detected)</span>}
                    </div>
                    <div className="text-[color:var(--muted)] truncate">{r.email}</div>
                  </div>
                  <div className="text-[color:var(--muted)] font-mono whitespace-nowrap">
                    → {greeting}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            Continue → ({parsed.rows.length})
          </button>
        ) : (
          <>
            <button
              type="submit"
              disabled={pending}
              className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Sending…" : `Send to ${parsed.rows.length} recipient${parsed.rows.length === 1 ? "" : "s"}`}
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
