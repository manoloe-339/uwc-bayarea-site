"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type AlumniHit = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  photo_url: string | null;
};

export function AddSpecialGuestButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
      >
        + Add special guest
      </button>
      {open && <AddSpecialGuestModal slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddSpecialGuestModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AlumniHit[]>([]);
  const [picked, setPicked] = useState<AlumniHit | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [starred, setStarred] = useState(false);
  const [followup, setFollowup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (picked) return;
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
        // aborted — ignore
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query, picked]);

  const submit = async () => {
    setError(null);
    if (!picked && !newName.trim()) {
      setError("Pick an alumnus or enter a new guest name.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ticket-events/${slug}/special-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: picked?.id ?? null,
          name: picked ? null : newName.trim(),
          email: picked ? null : newEmail.trim() || null,
          notes: notes.trim() || null,
          is_starred: starred,
          needs_followup: followup,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add guest");
      }
      startTransition(() => router.refresh());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-[12px] shadow-xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
        <h2 className="font-sans font-bold text-navy text-lg mb-1">Add special guest (comp)</h2>
        <p className="text-xs text-[color:var(--muted)] mb-4">
          Search the alumni database to match an existing person, or enter a new guest.
        </p>

        {!picked ? (
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
                      onClick={() => setPicked(r)}
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
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-2">
              or enter a new guest
            </div>
            <div className="space-y-2 mb-4">
              <label className="block">
                <span className="block text-xs text-[color:var(--muted)] mb-0.5">Name</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-[color:var(--muted)] mb-0.5">Email (optional)</span>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
                />
              </label>
            </div>
          </>
        ) : (
          <div className="mb-4 p-3 bg-ivory-2 border border-[color:var(--rule)] rounded flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-navy truncate">
                {[picked.first_name, picked.last_name].filter(Boolean).join(" ") || picked.email}
              </div>
              <div className="text-xs text-[color:var(--muted)] truncate">
                {picked.uwc_college ?? "—"}{picked.grad_year ? ` '${String(picked.grad_year).slice(-2)}` : ""}
                {picked.email ? ` · ${picked.email}` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-xs text-[color:var(--muted)] hover:text-navy"
            >
              Change
            </button>
          </div>
        )}

        <label className="block mb-3">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            placeholder="e.g. Major donor, VIP seating"
          />
        </label>

        <div className="flex gap-6 mb-5 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={starred} onChange={(e) => setStarred(e.target.checked)} />
            Star as VIP
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={followup} onChange={(e) => setFollowup(e.target.checked)} />
            Needs follow-up
          </label>
        </div>

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
            onClick={submit}
            disabled={submitting}
            className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add guest"}
          </button>
        </div>
      </div>
    </div>
  );
}
