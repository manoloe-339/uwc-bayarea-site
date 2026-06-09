"use client";

import { useState } from "react";

type Hit = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
};

/** Search + pick widget for the "Invite a new user" form. Uses the
 * existing /api/admin/help-out/search-alumni endpoint and stores the
 * selected alum's id in a hidden `alumni_id` input so the server
 * action sees it unchanged. */
export default function InvitePicker() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Hit | null>(null);

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
      const data = (await res.json()) as { results: Hit[] };
      setHits(data.results);
    } finally {
      setSearching(false);
    }
  };

  if (picked) {
    const name = [picked.first_name, picked.last_name]
      .filter(Boolean)
      .join(" ") || "(no name)";
    const sub = [picked.uwc_college, picked.grad_year]
      .filter(Boolean)
      .join(" · ");
    return (
      <div>
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
          Alumnus
        </span>
        <div className="flex items-center justify-between gap-3 bg-white border border-navy rounded px-3 py-2 sm:w-[420px]">
          <div className="min-w-0">
            <div className="font-semibold text-sm text-[color:var(--navy-ink)]">
              {name}{" "}
              <span className="text-xs text-[color:var(--muted)] font-normal">
                #{picked.id}
              </span>
            </div>
            <div className="text-xs text-[color:var(--muted)] truncate">
              {picked.email ?? "(no email on file)"}
              {sub ? ` · ${sub}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setQuery("");
              setHits([]);
            }}
            className="text-xs text-[color:var(--muted)] hover:text-navy whitespace-nowrap"
          >
            × Change
          </button>
        </div>
        <input type="hidden" name="alumni_id" value={picked.id} />
      </div>
    );
  }

  return (
    <div>
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        Alumnus
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          void search(e.target.value);
        }}
        placeholder="Type a name to search…"
        className="w-full sm:w-[420px] border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
        autoComplete="off"
      />
      {searching && (
        <div className="mt-2 text-xs text-[color:var(--muted)]">Searching…</div>
      )}
      {!searching && query.trim().length >= 2 && hits.length === 0 && (
        <div className="mt-2 text-xs text-[color:var(--muted)]">
          No matches.
        </div>
      )}
      {hits.length > 0 && (
        <ul className="mt-2 sm:w-[420px] bg-white border border-[color:var(--rule)] rounded divide-y divide-[color:var(--rule)] max-h-[280px] overflow-y-auto">
          {hits.map((h) => {
            const name =
              [h.first_name, h.last_name].filter(Boolean).join(" ") ||
              "(no name)";
            const sub = [h.uwc_college, h.grad_year]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(h);
                    setHits([]);
                  }}
                  className="w-full text-left py-2 px-3 hover:bg-[color:var(--ivory-2)]"
                >
                  <div className="font-semibold text-sm text-[color:var(--navy-ink)]">
                    {name}{" "}
                    <span className="text-xs text-[color:var(--muted)] font-normal">
                      #{h.id}
                    </span>
                  </div>
                  <div className="text-xs text-[color:var(--muted)] truncate">
                    {h.email ?? "(no email)"}
                    {sub ? ` · ${sub}` : ""}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
