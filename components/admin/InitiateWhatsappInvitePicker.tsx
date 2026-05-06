"use client";

import { useState } from "react";
import { initiateWhatsappInviteAction } from "@/app/admin/tools/whatsapp/actions";

interface AlumniHit {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
}

export function InitiateWhatsappInvitePicker() {
  const [selected, setSelected] = useState<AlumniHit | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AlumniHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const search = async (value: string) => {
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/help-out/search-alumni?q=${encodeURIComponent(value)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: AlumniHit[] };
      setHits(data.results);
    } finally {
      setSearching(false);
    }
  };

  const pick = (a: AlumniHit) => {
    setSelected(a);
    setQ("");
    setHits([]);
  };

  const fullName = (a: AlumniHit) =>
    [a.first_name, a.last_name].filter(Boolean).join(" ") || "(no name)";

  const canSend = !!selected && !!selected.email && !submitting;

  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 mb-4">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
        Send invite to a registered alum
      </div>
      <p className="text-xs text-[color:var(--muted)] mb-3">
        Search the directory, pick the alum, and send. Logs as a regular
        registered request below.
      </p>

      {selected ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-[color:var(--rule)] rounded px-3 py-2 mb-3">
          <div className="min-w-0">
            <div className="font-semibold text-sm text-[color:var(--navy-ink)]">
              {fullName(selected)}
            </div>
            <div className="text-xs text-[color:var(--muted)] truncate">
              {selected.email ?? (
                <span className="text-rose-700 font-semibold">No email on file</span>
              )}
              {[selected.uwc_college, selected.grad_year]
                .filter(Boolean)
                .join(" · ") && (
                <span className="italic">
                  {" · "}
                  {[selected.uwc_college, selected.grad_year]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-[color:var(--muted)] hover:text-navy"
            >
              Clear
            </button>
            <form
              action={initiateWhatsappInviteAction}
              onSubmit={(e) => {
                if (
                  !confirm(
                    `Send the WhatsApp invite email to ${fullName(selected)} (${selected.email})?`,
                  )
                ) {
                  e.preventDefault();
                  return;
                }
                setSubmitting(true);
              }}
            >
              <input type="hidden" name="alumni_id" value={selected.id} />
              <button
                type="submit"
                disabled={!canSend}
                className="text-xs font-semibold px-3 py-1.5 rounded bg-navy text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending…" : "Send invite"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              void search(e.target.value);
            }}
            placeholder="Search alumni by name or email…"
            className="flex-1 border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
          />
        </div>
      )}

      {!selected && q.trim().length >= 2 && (
        <div className="border border-[color:var(--rule)] rounded">
          {searching && (
            <div className="text-xs text-[color:var(--muted)] px-3 py-2">
              Searching…
            </div>
          )}
          {!searching && hits.length === 0 && (
            <div className="text-xs text-[color:var(--muted)] px-3 py-2">
              No matches.
            </div>
          )}
          {hits.length > 0 && (
            <ul className="divide-y divide-[color:var(--rule)] max-h-[280px] overflow-y-auto">
              {hits.map((h) => {
                const sub = [h.uwc_college, h.grad_year].filter(Boolean).join(" · ");
                return (
                  <li
                    key={h.id}
                    className="px-3 py-2 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-[color:var(--navy-ink)]">
                        {fullName(h)}
                      </div>
                      <div className="text-xs text-[color:var(--muted)] truncate">
                        {h.email ?? (
                          <span className="text-rose-700">no email</span>
                        )}
                        {sub && <span className="italic"> · {sub}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => pick(h)}
                      className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded hover:opacity-90 whitespace-nowrap"
                    >
                      Pick
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
