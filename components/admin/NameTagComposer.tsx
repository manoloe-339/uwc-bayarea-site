"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NameTag, NameTagStatus } from "@/lib/event-name-tags";

type SaveState = "idle" | "saving" | "saved" | "error";
type Filter = "all" | NameTagStatus;

export function NameTagComposer({
  eventId,
  initialTags,
}: {
  eventId: number;
  initialTags: NameTag[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tags, setTags] = useState<NameTag[]>(initialTags);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = () => startTransition(() => router.refresh());

  const counts = useMemo(() => {
    const c = { all: tags.length, pending: 0, fix: 0, finalized: 0 };
    for (const t of tags) c[t.status]++;
    return c;
  }, [tags]);

  const visibleTags = useMemo(
    () => (filter === "all" ? tags : tags.filter((t) => t.status === filter)),
    [tags, filter]
  );

  const onSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/name-tags/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { added?: number; skipped?: number };
      setSyncMsg(
        `Added ${data.added ?? 0} tag${data.added === 1 ? "" : "s"}. ` +
          `${data.skipped ?? 0} attendee${data.skipped === 1 ? "" : "s"} already had one.`
      );
      refresh();
    } catch (err) {
      setSyncMsg(err instanceof Error ? `Failed: ${err.message}` : "Failed");
    } finally {
      setSyncing(false);
    }
  };

  const onAdd = async () => {
    setAdding(true);
    try {
      const res = await fetch("/api/admin/name-tags/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, first_name: "", last_name: "" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tag?: NameTag };
      if (data.tag) {
        setTags((prev) => [data.tag!, ...prev]);
      }
      refresh();
    } finally {
      setAdding(false);
    }
  };

  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({});
  const setSaveState = (id: number, state: SaveState) =>
    setSaveStates((prev) => ({ ...prev, [id]: state }));

  const onChange = (id: number, patch: Partial<NameTag>) => {
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const onSetStatus = async (id: number, status: NameTagStatus) => {
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setSaveState(id, "saving");
    try {
      const res = await fetch("/api/admin/name-tags/set-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveState(id, "saved");
      refresh();
      setTimeout(() => {
        setSaveStates((prev) => (prev[id] === "saved" ? { ...prev, [id]: "idle" } : prev));
      }, 1500);
    } catch {
      setSaveState(id, "error");
    }
  };

  const onRefresh = async (id: number) => {
    setSaveState(id, "saving");
    try {
      const res = await fetch("/api/admin/name-tags/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tag?: NameTag };
      if (data.tag) {
        setTags((prev) => prev.map((t) => (t.id === id ? data.tag! : t)));
      }
      setSaveState(id, "saved");
      refresh();
      setTimeout(() => {
        setSaveStates((prev) => (prev[id] === "saved" ? { ...prev, [id]: "idle" } : prev));
      }, 2000);
    } catch {
      setSaveState(id, "error");
    }
  };

  const onSave = async (id: number, patch: Partial<NameTag>) => {
    setSaveState(id, "saving");
    try {
      const res = await fetch("/api/admin/name-tags/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveState(id, "saved");
      refresh();
      // Drop back to idle after 2s so the indicator doesn't linger forever.
      setTimeout(() => {
        setSaveStates((prev) => (prev[id] === "saved" ? { ...prev, [id]: "idle" } : prev));
      }, 2000);
    } catch {
      setSaveState(id, "error");
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Delete this name tag?")) return;
    setTags((prev) => prev.filter((t) => t.id !== id));
    await fetch("/api/admin/name-tags/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refresh();
  };

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded hover:opacity-90 disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync new attendees"}
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white disabled:opacity-50"
        >
          + Add tag
        </button>
        {syncMsg && (
          <span className="text-xs text-[color:var(--navy-ink)] bg-ivory-2 border-l-2 border-navy px-2 py-1 rounded-[2px]">
            {syncMsg}
          </span>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[color:var(--rule)] mb-4">
        <FilterTab label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterTab label="Finalized" count={counts.finalized} tone="emerald" active={filter === "finalized"} onClick={() => setFilter("finalized")} />
        <FilterTab label="Needs fix" count={counts.fix} tone="rose" active={filter === "fix"} onClick={() => setFilter("fix")} />
        <FilterTab label="Pending" count={counts.pending} tone="amber" active={filter === "pending"} onClick={() => setFilter("pending")} />
      </div>

      {visibleTags.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-sm text-[color:var(--muted)]">
          {tags.length === 0 ? (
            <>
              No name tags yet. Click <strong>Sync new attendees</strong> to pull
              from ticket purchasers, or <strong>+ Add tag</strong> for guests / VIPs.
            </>
          ) : (
            <>No tags in this view.</>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleTags.map((t) => (
            <NameTagRow
              key={t.id}
              tag={t}
              saveState={saveStates[t.id] ?? "idle"}
              onChange={(patch) => onChange(t.id, patch)}
              onSave={(patch) => onSave(t.id, patch)}
              onDelete={() => onDelete(t.id)}
              onRefresh={() => onRefresh(t.id)}
              onSetStatus={(s) => onSetStatus(t.id, s)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterTab({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone?: "emerald" | "rose" | "amber";
  active: boolean;
  onClick: () => void;
}) {
  const activeColor =
    tone === "emerald"
      ? "border-emerald-600 text-emerald-700"
      : tone === "rose"
      ? "border-rose-600 text-rose-700"
      : tone === "amber"
      ? "border-amber-600 text-amber-700"
      : "border-navy text-navy";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 -mb-px ${
        active
          ? `${activeColor} font-semibold`
          : "border-transparent text-[color:var(--muted)] hover:text-navy"
      }`}
    >
      {label}
      <span className="ml-1.5 text-[11px] text-[color:var(--muted)]">({count})</span>
    </button>
  );
}

function NameTagRow({
  tag,
  saveState,
  onChange,
  onSave,
  onDelete,
  onRefresh,
  onSetStatus,
}: {
  tag: NameTag;
  saveState: SaveState;
  onChange: (patch: Partial<NameTag>) => void;
  onSave: (patch: Partial<NameTag>) => void;
  onDelete: () => void;
  onRefresh: () => void;
  onSetStatus: (s: NameTagStatus) => void;
}) {
  const sourceLabel =
    tag.attendee_id == null
      ? "Manual"
      : tag.attendee_alumni_first_name && tag.attendee_alumni_last_name
      ? `From ticket: ${tag.attendee_alumni_first_name} ${tag.attendee_alumni_last_name}`
      : tag.attendee_stripe_customer_name
      ? `From ticket: ${tag.attendee_stripe_customer_name}`
      : "From ticket";

  const statusBorder =
    tag.status === "finalized"
      ? "border-l-4 border-l-emerald-500"
      : tag.status === "fix"
      ? "border-l-4 border-l-rose-500"
      : "";

  return (
    <li className={`bg-white border border-[color:var(--rule)] rounded-[10px] p-4 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4 ${statusBorder}`}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className={`text-[10px] tracking-[.18em] uppercase font-bold px-2 py-0.5 rounded-full ${
              tag.attendee_id == null
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            {tag.attendee_id == null ? "Manual" : "From ticket"}
          </span>
          <span className="text-[11px] text-[color:var(--muted)] truncate">
            {sourceLabel}
          </span>
          <SaveIndicator state={saveState} />
          <div className="flex items-center gap-2 ml-auto">
            <StatusButtons status={tag.status} onSet={onSetStatus} />
            {tag.attendee_id != null && (
              <button
                type="button"
                onClick={onRefresh}
                className="text-[11px] text-navy hover:underline"
                title="Pull latest first/last/college/year from this attendee — only fills empty fields, never overwrites"
              >
                Refresh from source
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] text-rose-700 hover:underline"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field
            label="First name"
            value={tag.first_name}
            onChange={(v) => onChange({ first_name: v })}
            onBlur={(v) => onSave({ first_name: v })}
          />
          <Field
            label="Last name"
            value={tag.last_name}
            onChange={(v) => onChange({ last_name: v })}
            onBlur={(v) => onSave({ last_name: v })}
          />
          <Field
            label="UWC college"
            value={tag.uwc_college ?? ""}
            onChange={(v) => onChange({ uwc_college: v || null })}
            onBlur={(v) => onSave({ uwc_college: v || null })}
          />
          <Field
            label="Grad year"
            value={tag.grad_year == null ? "" : String(tag.grad_year)}
            type="number"
            onChange={(v) => onChange({ grad_year: v ? Number(v) : null })}
            onBlur={(v) => onSave({ grad_year: v ? Number(v) : null })}
          />
        </div>
        <Field
          label="Line 3 (optional)"
          value={tag.line_3 ?? ""}
          onChange={(v) => onChange({ line_3: v || null })}
          onBlur={(v) => onSave({ line_3: v || null })}
        />
        <Field
          label="Line 4 (optional)"
          value={tag.line_4 ?? ""}
          onChange={(v) => onChange({ line_4: v || null })}
          onBlur={(v) => onSave({ line_4: v || null })}
        />
        <Field
          label="Notes (admin only — not printed)"
          value={tag.notes ?? ""}
          onChange={(v) => onChange({ notes: v || null })}
          onBlur={(v) => onSave({ notes: v || null })}
        />
      </div>

      {/* Live preview */}
      <NameTagPreview tag={tag} />
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-0.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className="w-full border border-[color:var(--rule)] rounded px-2 py-1 text-sm bg-white"
      />
    </label>
  );
}

function StatusButtons({
  status,
  onSet,
}: {
  status: NameTagStatus;
  onSet: (s: NameTagStatus) => void;
}) {
  const Btn = ({
    value,
    label,
    activeCls,
  }: {
    value: NameTagStatus;
    label: string;
    activeCls: string;
  }) => {
    const isActive = status === value;
    // Click an active status to clear back to pending; otherwise set to that value.
    const handle = () => onSet(isActive && value !== "pending" ? "pending" : value);
    return (
      <button
        type="button"
        onClick={handle}
        title={isActive ? `Clear ${label}` : `Mark ${label}`}
        className={`text-[10px] tracking-[.14em] uppercase font-bold px-2 py-1 rounded-full border transition-colors ${
          isActive ? activeCls : "bg-white text-[color:var(--muted)] border-[color:var(--rule)] hover:text-navy"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="inline-flex items-center gap-1">
      <Btn value="finalized" label="✓ Finalized" activeCls="bg-emerald-600 text-white border-emerald-700" />
      <Btn value="fix" label="⚠ Fix" activeCls="bg-rose-600 text-white border-rose-700" />
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map: Record<Exclude<SaveState, "idle">, { label: string; cls: string }> = {
    saving: {
      label: "Saving…",
      cls: "bg-white text-[color:var(--muted)] border border-[color:var(--rule)]",
    },
    saved: {
      label: "✓ Saved",
      cls: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    },
    error: {
      label: "Error",
      cls: "bg-rose-50 text-rose-800 border border-rose-200",
    },
  };
  const { label, cls } = map[state];
  return (
    <span
      className={`text-[10px] tracking-[.18em] uppercase font-bold px-2 py-0.5 rounded-full ${cls}`}
      aria-live="polite"
    >
      {label}
    </span>
  );
}

function NameTagPreview({ tag }: { tag: NameTag }) {
  const fullName = [tag.first_name, tag.last_name].filter(Boolean).join(" ").trim();
  const collegeLine =
    tag.uwc_college && tag.grad_year
      ? `${tag.uwc_college} · ${tag.grad_year}`
      : tag.uwc_college ?? (tag.grad_year ? String(tag.grad_year) : "");
  return (
    <div className="bg-ivory-2 border border-[color:var(--rule)] rounded-[10px] p-4 flex flex-col items-center justify-center text-center min-h-[160px]">
      <div className="font-display font-bold text-[color:var(--navy-ink)] text-[22px] leading-tight">
        {fullName || <span className="text-[color:var(--muted)] italic">Name…</span>}
      </div>
      {collegeLine && (
        <div className="font-sans text-sm text-[color:var(--navy)] mt-1.5 font-semibold">
          {collegeLine}
        </div>
      )}
      {tag.line_3 && (
        <div className="font-sans text-xs text-[color:var(--muted)] mt-1 italic">
          {tag.line_3}
        </div>
      )}
      {tag.line_4 && (
        <div className="font-sans text-xs text-[color:var(--muted)] mt-0.5 italic">
          {tag.line_4}
        </div>
      )}
    </div>
  );
}
