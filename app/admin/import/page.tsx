"use client";

import { useState } from "react";

type Report = {
  total: number;
  rowsWithEmail?: number;
  parsed?: number;
  inserted: number;
  updated: number;
  skipped: number;
  flagged: number;
  flaggedEmails: string[];
};

export default function ImportPage() {
  return (
    <div className="max-w-[720px]">
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-2">Import alumni CSVs</h1>
      <p className="text-[color:var(--muted)] mb-6">
        Rows are upserted by email. UWC college and graduation year are normalized on import.
      </p>

      <ImportForm
        title="Original UWCx Google Form"
        endpoint="/api/admin/import"
        sourceLabel="google_form_uwcx"
      />
      <div className="h-6" />
      <ImportForm
        title="SF Public Library list"
        endpoint="/api/admin/import/sf-pub-lib"
        sourceLabel="sf_pub_lib"
        description="For email collisions, the existing record's name/city/bio are preserved; only empty fields are filled in, and sf_pub_lib is appended to the sources array."
      />
    </div>
  );
}

function ImportForm({
  title,
  endpoint,
  sourceLabel,
  description,
}: {
  title: string;
  endpoint: string;
  sourceLabel: string;
  description?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(endpoint, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Import failed: ${res.status}`);
      const r = (await res.json()) as Report;
      setReport(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 shadow-[0_2px_0_var(--ivory-3)]">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-sans text-lg font-bold text-[color:var(--navy-ink)]">{title}</h2>
        <span className="text-[10px] tracking-[.22em] uppercase text-[color:var(--muted)]">source: {sourceLabel}</span>
      </div>
      {description && <p className="text-xs text-[color:var(--muted)] mb-4">{description}</p>}

      <label className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">CSV file</label>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />
      <button
        type="submit"
        disabled={!file || busy}
        className="mt-6 bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide disabled:opacity-50"
      >
        {busy ? "Importing…" : "Import"}
      </button>

      {error && <div className="mt-4 p-3 border-l-4 border-red-600 bg-red-50 text-sm">{error}</div>}

      {report && (
        <div className="mt-5 border-t border-[color:var(--rule)] pt-5">
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Total rows" value={report.total} />
            <Stat label="Parsed" value={report.parsed ?? report.rowsWithEmail ?? 0} />
            <Stat label="Inserted" value={report.inserted} />
            <Stat label="Updated" value={report.updated} />
            <Stat label="Skipped" value={report.skipped} />
            <Stat label="Flagged" value={report.flagged} />
          </dl>
          {report.flaggedEmails.length > 0 && (
            <>
              <h3 className="mt-4 text-[11px] tracking-[.22em] uppercase font-bold text-navy">Flagged rows</h3>
              <ul className="mt-2 text-sm text-[color:var(--navy-ink)] list-disc pl-5">
                {report.flaggedEmails.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">{label}</dt>
      <dd className="text-xl font-sans font-bold text-[color:var(--navy-ink)]">{value}</dd>
    </div>
  );
}
