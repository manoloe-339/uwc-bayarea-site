"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EnrichmentStatus } from "@/types/enrichment";
import { EnrichmentStatusBadge } from "./StatusBadge";

type Props = {
  alumniId: number;
  status: EnrichmentStatus;
  enrichedAt: string | null;
  error: string | null;
  rawData: unknown;
  /** Snapshot of fields the manual override form pre-fills with. */
  current: {
    headline: string | null;
    current_company: string | null;
    current_title: string | null;
    location_city: string | null;
    location_country: string | null;
    about: string | null;
  };
};

function fmtTime(s: string): string {
  return new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EnrichmentSection({
  alumniId,
  status,
  enrichedAt,
  error,
  rawData,
  current,
}: Props) {
  const [retrying, setRetrying] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // While enrichment is pending, hammer router.refresh() every 5s so the
  // status badge transitions live without the admin needing to reload.
  useEffect(() => {
    if (status !== "pending") return;
    const tick = () => startTransition(() => router.refresh());
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [status, router]);

  const reEnrich = async () => {
    if (!confirm("Re-run enrichment? Will overwrite scraped fields (your typed fields are preserved via COALESCE).")) return;
    setRetrying(true);
    setRetryMsg(null);
    try {
      const res = await fetch("/api/enrichment/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? body.message ?? "Failed");
      setRetryMsg("Queued — refresh in ~60s");
      startTransition(() => router.refresh());
    } catch (err) {
      setRetryMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setRetrying(false);
    }
  };

  const isManual =
    rawData != null &&
    typeof rawData === "object" &&
    (rawData as { source?: string }).source === "manual_override";

  return (
    <section
      id="enrichment"
      className="mt-8 bg-white border border-[color:var(--rule)] rounded-[10px] p-5"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
          LinkedIn enrichment
        </h2>
        <EnrichmentStatusBadge status={status} enrichedAt={enrichedAt} error={error} />
      </div>

      <dl className="text-sm space-y-1 mb-4">
        {enrichedAt && (
          <div className="flex items-baseline gap-2">
            <dt className="text-[color:var(--muted)]">Last run:</dt>
            <dd>{fmtTime(enrichedAt)}</dd>
          </div>
        )}
        {error && (
          <div className="flex items-baseline gap-2">
            <dt className="text-[color:var(--muted)]">Error:</dt>
            <dd className="text-red-700 break-words">{error}</dd>
          </div>
        )}
        {isManual && (
          <div className="text-xs text-amber-700">
            Marked complete via manual override — no LinkedIn scrape on file.
          </div>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={reEnrich}
          disabled={retrying}
          className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-60"
        >
          {retrying ? "Triggering…" : status === "complete" ? "Re-enrich" : "Run enrichment"}
        </button>
        {rawData ? (
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="border border-[color:var(--rule)] text-navy px-4 py-2 rounded text-sm font-semibold hover:bg-ivory-2"
          >
            {showRaw ? "Hide raw data" : "View raw data"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setShowOverride((v) => !v)}
          className="border border-amber-500 text-amber-800 px-4 py-2 rounded text-sm font-semibold hover:bg-amber-50"
        >
          {showOverride ? "Hide manual override" : "Manual override"}
        </button>
        {retryMsg && (
          <span className="text-xs text-[color:var(--muted)]">{retryMsg}</span>
        )}
      </div>

      {showRaw && rawData != null && (
        <pre className="mt-2 bg-ivory-2 border border-[color:var(--rule)] rounded p-3 text-[11px] leading-relaxed overflow-auto max-h-[400px]">
          {JSON.stringify(rawData, null, 2)}
        </pre>
      )}

      {showOverride && (
        <ManualOverrideForm
          alumniId={alumniId}
          current={current}
          onSaved={() => {
            setShowOverride(false);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </section>
  );
}

function ManualOverrideForm({
  alumniId,
  current,
  onSaved,
}: {
  alumniId: number;
  current: Props["current"];
  onSaved: () => void;
}) {
  const [headline, setHeadline] = useState(current.headline ?? "");
  const [company, setCompany] = useState(current.current_company ?? "");
  const [title, setTitle] = useState(current.current_title ?? "");
  const [city, setCity] = useState(current.location_city ?? "");
  const [country, setCountry] = useState(current.location_country ?? "");
  const [about, setAbout] = useState(current.about ?? "");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPhoto = (file: File | null) => {
    if (!file) {
      setPhotoDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setPhotoDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/enrichment/manual-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: alumniId,
          headline: headline.trim() || null,
          current_company: company.trim() || null,
          current_title: title.trim() || null,
          location_city: city.trim() || null,
          location_country: country.trim() || null,
          about: about.trim() || null,
          photo: photoDataUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-amber-50/50 border border-amber-200 rounded space-y-3">
      <p className="text-xs text-amber-800">
        Type values directly when LinkedIn scraping isn&rsquo;t available. Saves status
        as <code>complete</code> with{" "}
        <code className="bg-amber-100 px-1 rounded">source=manual_override</code>{" "}
        in the audit JSON.
      </p>
      <Field label="Headline" value={headline} onChange={setHeadline} placeholder="e.g. Product Manager at Stripe" />
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Current company" value={company} onChange={setCompany} />
        <Field label="Current title" value={title} onChange={setTitle} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="City" value={city} onChange={setCity} />
        <Field label="Country" value={country} onChange={setCountry} />
      </div>
      <label className="block">
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
          About
        </span>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
        />
      </label>
      <label className="block">
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
          Photo (optional)
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        {photoDataUrl && (
          <img
            src={photoDataUrl}
            alt=""
            className="mt-2 w-20 h-20 rounded-full object-cover border border-[color:var(--rule)]"
          />
        )}
      </label>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save manual override"}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}
