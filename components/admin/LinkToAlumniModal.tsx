"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RELATIONSHIP_OPTIONS } from "@/lib/attendee-labels";

type AlumniHit = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  photo_url: string | null;
};

type Props = {
  attendeeId: number;
  displayName: string;
  initialAssociatedAlumniId: number | null;
  initialAssociatedName: string | null;
  initialRelationshipType: string | null;
  initialIsPotentialDonor: boolean;
  onClose: () => void;
};

export function LinkToAlumniModal({
  attendeeId,
  displayName,
  initialAssociatedAlumniId,
  initialAssociatedName,
  initialRelationshipType,
  initialIsPotentialDonor,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AlumniHit[]>([]);
  const [pickedId, setPickedId] = useState<number | null>(initialAssociatedAlumniId);
  const [pickedName, setPickedName] = useState<string | null>(initialAssociatedName);
  const [relationship, setRelationship] = useState<string>(initialRelationshipType ?? "");
  const [donor, setDonor] = useState(initialIsPotentialDonor);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
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
        setResults(results);
      } catch {
        // aborted
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query]);

  const save = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ticket-events/attendees/${attendeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          associated_with_alumni_id: pickedId,
          relationship_type: pickedId ? relationship || null : null,
          is_potential_donor: donor,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      startTransition(() => router.refresh());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const clearAssociation = () => {
    setPickedId(null);
    setPickedName(null);
    setRelationship("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-[12px] shadow-xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
        <h2 className="font-sans font-bold text-navy text-lg mb-1">Link {displayName} to alumni</h2>
        <p className="text-xs text-[color:var(--muted)] mb-4">
          Capture that this attendee is here with an existing alum — e.g. their partner,
          friend, or colleague.
        </p>

        {pickedId ? (
          <div className="mb-5 p-3 bg-ivory-2 border border-[color:var(--rule)] rounded flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
                Associated with
              </div>
              <div className="font-semibold text-navy truncate">{pickedName ?? "(selected)"}</div>
            </div>
            <button
              type="button"
              onClick={clearAssociation}
              className="text-xs text-[color:var(--muted)] hover:text-navy"
            >
              Clear
            </button>
          </div>
        ) : (
          <>
            <label className="block mb-3">
              <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
                Search alumni
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or email (min 2 chars)"
                className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
                autoFocus
              />
            </label>
            {results.length > 0 && (
              <ul className="mb-4 border border-[color:var(--rule)] rounded divide-y divide-[color:var(--rule)] max-h-[240px] overflow-y-auto">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPickedId(r.id);
                        setPickedName(
                          [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || `#${r.id}`
                        );
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-ivory-2 flex gap-3 items-center text-sm"
                    >
                      {r.photo_url ? (
                        <img src={r.photo_url} alt="" className="w-8 h-8 rounded-full object-cover bg-ivory-2 border border-[color:var(--rule)]" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-ivory-2 border border-[color:var(--rule)] flex items-center justify-center text-[color:var(--muted)] text-xs font-sans font-bold">
                          {(r.first_name?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-navy truncate">
                          {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}
                        </div>
                        <div className="text-xs text-[color:var(--muted)] truncate">
                          {r.uwc_college ?? "—"}{r.grad_year ? ` '${String(r.grad_year).slice(-2)}` : ""} · {r.email}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {pickedId && (
          <label className="block mb-4">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
              Relationship
            </span>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            >
              <option value="">—</option>
              {RELATIONSHIP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm mb-5">
          <input type="checkbox" checked={donor} onChange={(e) => setDonor(e.target.checked)} />
          Mark as potential donor
        </label>

        {error && <div className="mb-3 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={submitting}
            className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

