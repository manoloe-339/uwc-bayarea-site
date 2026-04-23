"use client";

import { useEffect, useRef, useState } from "react";

type Hit = {
  id: number;
  attendee_type: "paid" | "comp" | "walk-in";
  amount_paid: string;
  checked_in: boolean;
  checked_in_at: string | null;
  refund_status: string | null;
  display_first: string | null;
  display_last: string | null;
  display_email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  origin: string | null;
  photo_url: string | null;
  alumni_id: number | null;
  paid_at: string | null;
};

type AlumniHit = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  photo_url: string | null;
};

const RELATIONSHIP_OPTIONS = [
  { value: "uwc_alum_not_in_db", label: "UWC alum (not in our database)" },
  { value: "friend", label: "Friend of alum" },
  { value: "plus_one", label: "Plus-one" },
  { value: "spouse_partner", label: "Spouse / partner" },
  { value: "family", label: "Family member" },
  { value: "colleague", label: "Colleague" },
  { value: "other", label: "Other guest" },
];

export function WalkinPanel({
  token,
  onDone,
}: {
  token: string;
  onDone: (hit: Hit) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [college, setCollege] = useState("");
  const [relationship, setRelationship] = useState("uwc_alum_not_in_db");
  const [notes, setNotes] = useState("");
  const [broughtByQuery, setBroughtByQuery] = useState("");
  const [broughtByResults, setBroughtByResults] = useState<AlumniHit[]>([]);
  const [broughtBy, setBroughtBy] = useState<AlumniHit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (broughtBy) return;
    const q = broughtByQuery.trim();
    if (q.length < 2) {
      setBroughtByResults([]);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ticket-events/alumni-search?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        if (!res.ok) return;
        const { results } = (await res.json()) as { results: AlumniHit[] };
        if (!ac.signal.aborted) setBroughtByResults(results);
      } catch {
        // aborted
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [broughtByQuery, broughtBy]);

  const submit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/checkin/${token}/walkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          college: college.trim() || null,
          relationship_type: relationship || null,
          associated_with_alumni_id: broughtBy?.id ?? null,
          notes: notes.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to add walk-in");
      }
      onDone(body.hit as Hit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[12px] p-4 space-y-3">
      <div className="text-sm font-semibold text-navy">Add walk-in guest</div>

      <L label="Name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className={inputCls}
        />
      </L>
      <L label="Email (optional)">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </L>
      <L label="UWC college (optional)">
        <input
          type="text"
          value={college}
          onChange={(e) => setCollege(e.target.value)}
          placeholder="e.g. UWC Atlantic"
          className={inputCls}
        />
      </L>
      <L label="Relationship">
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          className={inputCls}
        >
          {RELATIONSHIP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </L>
      <L label="Brought by (optional alumni search)">
        {broughtBy ? (
          <div className="flex items-center justify-between gap-3 bg-ivory-2 border border-[color:var(--rule)] rounded px-3 py-2">
            <span className="text-sm font-semibold text-navy truncate">
              {[broughtBy.first_name, broughtBy.last_name].filter(Boolean).join(" ")}
              {broughtBy.uwc_college ? ` · ${broughtBy.uwc_college}` : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setBroughtBy(null);
                setBroughtByQuery("");
                setBroughtByResults([]);
              }}
              className="text-xs text-[color:var(--muted)] hover:text-navy"
            >
              Clear
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={broughtByQuery}
              onChange={(e) => setBroughtByQuery(e.target.value)}
              placeholder="Search alumni (min 2 chars)"
              className={inputCls}
            />
            {broughtByResults.length > 0 && (
              <ul className="mt-1 border border-[color:var(--rule)] rounded divide-y divide-[color:var(--rule)] max-h-[160px] overflow-y-auto">
                {broughtByResults.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setBroughtBy(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-ivory-2"
                    >
                      <span className="font-semibold text-navy">
                        {[r.first_name, r.last_name].filter(Boolean).join(" ")}
                      </span>
                      <span className="text-xs text-[color:var(--muted)] ml-2">
                        {r.uwc_college ?? "—"}
                        {r.grad_year ? ` '${String(r.grad_year).slice(-2)}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </L>
      <L label="Notes (optional)">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputCls}
        />
      </L>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !name.trim()}
        className="w-full bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-[12px] text-base font-sans font-bold disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add & check in"}
      </button>
    </div>
  );
}

const inputCls =
  "w-full border border-[color:var(--rule)] rounded px-3 py-2 text-base bg-white";

function L({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
