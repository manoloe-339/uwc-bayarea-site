"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface AlumniHit {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
}

export function VolunteerLinkPicker({
  signupId,
  initialQuery,
}: {
  signupId: number;
  initialQuery: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(initialQuery);
  const [hits, setHits] = useState<AlumniHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const search = async (value: string) => {
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/help-out/search-alumni?q=${encodeURIComponent(value)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: AlumniHit[] };
      setHits(data.results);
    } finally {
      setSearching(false);
    }
  };

  const link = async (alumniId: number) => {
    setLinkErr(null);
    const formData = new FormData();
    formData.set("id", String(signupId));
    formData.set("alumni_id", String(alumniId));
    try {
      const res = await fetch(`/api/admin/help-out/link?id=${signupId}&alumni_id=${alumniId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : "Failed");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (initialQuery && hits.length === 0) {
            void search(initialQuery);
          }
        }}
        className="text-xs font-semibold text-navy hover:underline"
      >
        Link to alumni →
      </button>
    );
  }

  return (
    <div className="mt-2 bg-white border border-[color:var(--rule)] rounded-[8px] p-3 max-w-[520px]">
      <div className="flex items-center gap-2 mb-2">
        <input
          type="search"
          value={q}
          autoFocus
          onChange={(e) => {
            setQ(e.target.value);
            void search(e.target.value);
          }}
          placeholder="Search alumni by name or email…"
          className="flex-1 border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[color:var(--muted)] hover:text-navy"
        >
          Cancel
        </button>
      </div>
      {searching && (
        <div className="text-xs text-[color:var(--muted)] py-2">Searching…</div>
      )}
      {!searching && q.trim().length >= 2 && hits.length === 0 && (
        <div className="text-xs text-[color:var(--muted)] py-2">No matches.</div>
      )}
      {hits.length > 0 && (
        <ul className="divide-y divide-[color:var(--rule)] max-h-[320px] overflow-y-auto">
          {hits.map((h) => {
            const name =
              [h.first_name, h.last_name].filter(Boolean).join(" ") || "(no name)";
            const sub = [h.uwc_college, h.grad_year].filter(Boolean).join(" · ");
            return (
              <li key={h.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-[color:var(--navy-ink)]">
                    {name}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {h.email}
                    {sub && (
                      <span className="italic"> · {sub}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => link(h.id)}
                  className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded hover:opacity-90 whitespace-nowrap"
                >
                  Link
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {linkErr && (
        <div className="mt-2 text-xs text-rose-700">{linkErr}</div>
      )}
    </div>
  );
}
