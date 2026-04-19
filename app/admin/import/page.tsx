"use client";

import { useState } from "react";

type Report = {
  total: number;
  rowsWithEmail: number;
  inserted: number;
  updated: number;
  skipped: number;
  flagged: number;
  flaggedEmails: string[];
};

export default function ImportPage() {
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
      const res = await fetch("/api/admin/import", { method: "POST", body: form });
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
    <div className="max-w-[720px]">
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-2">Import alumni CSV</h1>
      <p className="text-[color:var(--muted)] mb-6">
        Upload a Google Form export. Rows are upserted by email. UWC college + graduation year are normalized on import.
      </p>

      <form onSubmit={onSubmit} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 shadow-[0_2px_0_var(--ivory-3)]">
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
      </form>

      {error && (
        <div className="mt-5 p-4 border-l-4 border-red-600 bg-red-50 text-sm">{error}</div>
      )}

      {report && (
        <div className="mt-6 bg-white border border-[color:var(--rule)] rounded-[10px] p-6">
          <h2 className="text-lg font-sans font-bold mb-3">Import report</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Total rows" value={report.total} />
            <Stat label="With email" value={report.rowsWithEmail} />
            <Stat label="Inserted" value={report.inserted} />
            <Stat label="Updated" value={report.updated} />
            <Stat label="Skipped" value={report.skipped} />
            <Stat label="Flagged" value={report.flagged} />
          </dl>
          {report.flaggedEmails.length > 0 && (
            <>
              <h3 className="mt-5 text-[11px] tracking-[.22em] uppercase font-bold text-navy">
                Flagged (unparseable grad year or unknown college)
              </h3>
              <ul className="mt-2 text-sm text-[color:var(--navy-ink)] list-disc pl-5">
                {report.flaggedEmails.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">{label}</dt>
      <dd className="text-2xl font-sans font-bold text-[color:var(--navy-ink)]">{value}</dd>
    </div>
  );
}
