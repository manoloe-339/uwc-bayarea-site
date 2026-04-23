"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AttendeeCard } from "./AttendeeCard";
import { WalkinPanel } from "./WalkinPanel";

// Camera-heavy component — only load when the QR tab opens, so no
// getUserMedia init on the name-search flow.
const QrScanPanel = dynamic(
  () => import("./QrScanPanel").then((m) => m.QrScanPanel),
  { ssr: false, loading: () => <div className="text-sm text-[color:var(--muted)] text-center py-6">Loading scanner…</div> }
);

type Event = {
  id: number;
  name: string;
  date: string;
  time: string | null;
  location: string | null;
};

type Stats = {
  totalRegistered: number;
  checkedIn: number;
  walkIns: number;
  totalPresent: number;
  recent: Array<{
    id: number;
    display_name: string;
    checked_in_at: string;
    attendee_type: "paid" | "comp" | "walk-in";
    uwc_college: string | null;
    grad_year: number | null;
    photo_url: string | null;
  }>;
  last5MinCount: number;
};

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

type Mode = "search" | "scan" | "walkin";

export function CheckinApp({
  token,
  event,
  initialStats,
}: {
  token: string;
  event: Event;
  initialStats: Stats;
}) {
  const [mode, setMode] = useState<Mode>("search");
  const [stats, setStats] = useState(initialStats);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState<Hit | null>(null);
  const [celebrated, setCelebrated] = useState<{ name: string; college: string | null } | null>(
    null
  );
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Poll stats every 5s active, 30s hidden.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/checkin/${token}/stats`, { cache: "no-store" });
        if (res.ok) {
          const s = (await res.json()) as Stats;
          if (!cancelled) setStats(s);
        }
      } catch {
        // ignore — next tick retries
      }
    };
    let interval = setInterval(tick, 5000);
    const onVis = () => {
      clearInterval(interval);
      interval = setInterval(tick, document.hidden ? 30_000 : 5_000);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [token]);

  // Debounced search.
  useEffect(() => {
    if (mode !== "search") return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/checkin/${token}/search?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        if (res.ok) {
          const { results } = (await res.json()) as { results: Hit[] };
          if (!ac.signal.aborted) setResults(results);
        }
      } catch {
        // aborted
      } finally {
        if (!ac.signal.aborted) setSearching(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query, token, mode]);

  const checkIn = async (attendeeId: number) => {
    const res = await fetch(`/api/checkin/${token}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendee_id: attendeeId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body.error as string, checkedInAt: body.checked_in_at as string | null };
    }
    return { ok: true };
  };

  const undoCheckIn = async (attendeeId: number) => {
    await fetch(`/api/checkin/${token}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendee_id: attendeeId, undo: true }),
    });
  };

  const runSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/checkin/${token}/sync-stripe`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429 && body.retryInSeconds) {
          setSyncResult(`Please wait ${body.retryInSeconds}s before syncing again.`);
        } else {
          setSyncResult(body.error ?? "Sync failed");
        }
      } else {
        const addedTxt = body.created > 0 ? `${body.created} new` : "no new payments";
        const matched =
          body.rematched > 0 ? ` · ${body.rematched} rematched` : "";
        setSyncResult(`Found ${addedTxt}${matched}.`);
      }
    } finally {
      setSyncing(false);
      // Clear message after 5s
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  if (focused) {
    return (
      <AttendeeCard
        hit={focused}
        onCheckIn={async () => {
          const result = await checkIn(focused.id);
          if (!result.ok) {
            if (result.error === "already_checked_in") {
              alert(
                `Already checked in${
                  result.checkedInAt
                    ? " at " +
                      new Date(result.checkedInAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : ""
                }`
              );
            } else if (result.error === "refunded") {
              alert("This ticket was refunded. Can't check in.");
            } else {
              alert("Check-in failed.");
            }
            setFocused(null);
            return;
          }
          setCelebrated({
            name: [focused.display_first, focused.display_last].filter(Boolean).join(" "),
            college: focused.uwc_college,
          });
          setFocused(null);
          setQuery("");
          setResults([]);
          setTimeout(() => setCelebrated(null), 2400);
        }}
        onUndo={async () => {
          if (!confirm("Undo this check-in?")) return;
          await undoCheckIn(focused.id);
          setFocused(null);
        }}
        onCancel={() => setFocused(null)}
      />
    );
  }

  const percent = stats.totalRegistered === 0
    ? 0
    : Math.round((stats.checkedIn / stats.totalRegistered) * 100);

  return (
    <div className="max-w-[720px] mx-auto px-4 py-5">
      <header className="mb-4">
        <h1 className="font-sans text-2xl font-bold text-[color:var(--navy-ink)]">{event.name}</h1>
        <p className="text-xs text-[color:var(--muted)]">
          {event.date}
          {event.time ? ` · ${event.time}` : ""}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </header>

      <section className="bg-white border border-[color:var(--rule)] rounded-[12px] p-4 mb-4">
        <div className="text-sm font-semibold text-navy">
          ✓ {stats.checkedIn} checked in / {stats.totalRegistered} registered ({percent}%)
          {stats.walkIns > 0 && (
            <span className="ml-2 text-[color:var(--muted)] font-normal">
              · 🚶 {stats.walkIns} walk-in{stats.walkIns === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="mt-2 h-2 bg-ivory-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>

      <nav className="flex gap-2 mb-4" role="tablist">
        <ModeTab active={mode === "search"} onClick={() => setMode("search")}>
          Last name
        </ModeTab>
        <ModeTab active={mode === "scan"} onClick={() => setMode("scan")}>
          QR code
        </ModeTab>
        <ModeTab active={mode === "walkin"} onClick={() => setMode("walkin")}>
          Walk-in
        </ModeTab>
      </nav>

      {mode === "search" && (
        <>
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by last name…"
            autoFocus
            className="w-full border border-[color:var(--rule)] rounded-[10px] px-4 py-3 text-base bg-white mb-3"
          />
          {query.trim().length < 1 ? (
            <p className="text-sm text-[color:var(--muted)] text-center py-4">
              Type a last name to find attendees.
            </p>
          ) : searching ? (
            <p className="text-sm text-[color:var(--muted)] text-center py-4">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)] text-center py-4">
              No matches. Try a different spelling or use walk-in.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((r) => (
                <SearchResultRow key={r.id} hit={r} onPick={() => setFocused(r)} />
              ))}
            </ul>
          )}
        </>
      )}

      {mode === "scan" && <QrScanPanel token={token} onFound={(hit) => setFocused(hit)} />}

      {mode === "walkin" && (
        <WalkinPanel
          token={token}
          onDone={(hit) => {
            setCelebrated({
              name: [hit.display_first, hit.display_last].filter(Boolean).join(" "),
              college: hit.uwc_college,
            });
            setMode("search");
            setTimeout(() => setCelebrated(null), 2400);
          }}
        />
      )}

      {stats.recent.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[10px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-2">
            Recent check-ins
          </h2>
          <ul className="space-y-1 text-sm">
            {stats.recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 text-[color:var(--muted)]"
              >
                <span className="text-[color:var(--navy-ink)] truncate">
                  ✓ {r.display_name}
                  {r.attendee_type === "walk-in" && (
                    <span className="ml-1 text-[10px] text-indigo-700 uppercase tracking-wider">
                      walk-in
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs">
                    {new Date(r.checked_in_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !confirm(
                          `Undo check-in for ${r.display_name}? They'll be marked as not checked in.`
                        )
                      )
                        return;
                      await undoCheckIn(r.id);
                      // Optimistic: refresh stats immediately.
                      try {
                        const sres = await fetch(`/api/checkin/${token}/stats`, {
                          cache: "no-store",
                        });
                        if (sres.ok) setStats((await sres.json()) as Stats);
                      } catch {
                        /* next poll will refresh */
                      }
                    }}
                    className="text-xs text-red-700 hover:underline"
                  >
                    Undo
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 flex-wrap text-sm">
        <button
          type="button"
          onClick={runSync}
          disabled={syncing}
          className="text-[color:var(--muted)] hover:text-navy disabled:opacity-60"
        >
          {syncing ? "Syncing…" : "Sync Stripe now"}
        </button>
        {syncResult && <span className="text-xs text-[color:var(--muted)]">{syncResult}</span>}
      </div>

      {celebrated && (
        <CelebrationOverlay name={celebrated.name} college={celebrated.college} />
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-[10px] border ${
        active
          ? "bg-navy text-white border-navy"
          : "bg-white text-navy border-[color:var(--rule)]"
      }`}
    >
      {children}
    </button>
  );
}

function SearchResultRow({ hit, onPick }: { hit: Hit; onPick: () => void }) {
  const name =
    [hit.display_first, hit.display_last].filter(Boolean).join(" ") || "Unknown";
  const initial = (hit.display_first?.[0] ?? hit.display_last?.[0] ?? "?").toUpperCase();
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={`w-full text-left bg-white border rounded-[10px] p-3 flex items-center gap-3 text-sm ${
          hit.checked_in
            ? "border-green-300 bg-green-50/40"
            : "border-[color:var(--rule)]"
        }`}
      >
        {hit.photo_url ? (
          <img
            src={hit.photo_url}
            alt=""
            className="w-12 h-12 rounded-full object-cover bg-ivory-2 border border-[color:var(--rule)]"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-ivory-2 border border-[color:var(--rule)] flex items-center justify-center text-[color:var(--muted)] font-sans font-bold">
            {initial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-navy">{name}</div>
          <div className="text-xs text-[color:var(--muted)] truncate">
            {hit.uwc_college ?? "—"}
            {hit.grad_year ? ` '${String(hit.grad_year).slice(-2)}` : ""}
            {hit.attendee_type === "walk-in" && " · walk-in"}
          </div>
        </div>
        {hit.checked_in ? (
          <span className="text-xs font-semibold text-green-700">✓ In</span>
        ) : hit.refund_status === "refunded" ? (
          <span className="text-xs font-semibold text-red-700">Refunded</span>
        ) : (
          <span className="text-xs text-[color:var(--muted)]">→</span>
        )}
      </button>
    </li>
  );
}

function CelebrationOverlay({ name, college }: { name: string; college: string | null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm pointer-events-none">
      <div className="bg-white rounded-[16px] shadow-2xl px-10 py-8 text-center animate-checkin-pop">
        <div className="text-6xl mb-3">✅</div>
        <div className="font-sans font-bold text-navy text-2xl">Checked in!</div>
        <div className="text-[color:var(--navy-ink)] mt-1 font-semibold">{name}</div>
        {college && <div className="text-sm text-[color:var(--muted)] mt-1">🎓 {college}</div>}
        <div className="mt-4 text-sm">🎉 Welcome 🎉</div>
      </div>
    </div>
  );
}

