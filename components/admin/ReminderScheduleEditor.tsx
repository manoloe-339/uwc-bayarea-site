"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  slug: string;
  initialScheduledAt: string | null;
  autoSentAt: string | null;
  eventDateIso: string;
  eventTime: string | null;
};

// Format an ISO timestamp into the local-timezone value <input type="datetime-local"> expects.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function parseEventTime(eventDateIso: string, eventTime: string | null): string {
  // Best-effort default: event date @ 9am local the day before the event,
  // because that's when a typical "see you tomorrow" reminder goes out.
  void eventTime;
  const d = new Date(eventDateIso);
  d.setDate(d.getDate() - 1);
  d.setHours(9, 0, 0, 0);
  return isoToLocalInput(d.toISOString());
}

export function ReminderScheduleEditor({
  slug,
  initialScheduledAt,
  autoSentAt,
  eventDateIso,
  eventTime,
}: Props) {
  const dayBeforeDefault = useMemo(
    () => parseEventTime(eventDateIso, eventTime),
    [eventDateIso, eventTime]
  );
  const [local, setLocal] = useState(isoToLocalInput(initialScheduledAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const inPast = useMemo(() => {
    if (!local) return false;
    const d = new Date(local);
    return d.getTime() < Date.now();
  }, [local]);

  const save = async (nextIso: string | null) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/ticket-events/${slug}/reminder-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: nextIso }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => {
    if (!local) return;
    save(new Date(local).toISOString());
  };
  const onCancel = () => {
    setLocal("");
    save(null);
  };
  const onUseDefault = () => setLocal(dayBeforeDefault);

  const statusLine = autoSentAt
    ? `Auto-sent ${new Date(autoSentAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : initialScheduledAt
      ? `Will auto-send ${new Date(initialScheduledAt).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`
      : "Not scheduled — you can still send manually below.";

  return (
    <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
        Auto-send schedule
      </div>
      <p className="text-sm text-[color:var(--muted)] mb-3">
        {statusLine}
      </p>

      <div className="flex flex-wrap items-end gap-2 mb-2">
        <label className="block">
          <span className="block text-xs text-[color:var(--muted)] mb-1">
            Send reminder at
          </span>
          <input
            type="datetime-local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>
        <button
          type="button"
          onClick={onUseDefault}
          className="text-xs text-[color:var(--muted)] hover:text-navy pb-2"
        >
          Day before, 9:00 AM
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !local}
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving…" : initialScheduledAt ? "Reschedule" : "Schedule"}
          </button>
          {initialScheduledAt && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="text-sm text-red-700 hover:underline disabled:opacity-60"
            >
              Cancel schedule
            </button>
          )}
        </div>
      </div>

      {inPast && (
        <p className="text-xs text-amber-700">
          That time is in the past — the cron runs every 5 minutes, so a past
          time will fire on the next tick.
        </p>
      )}
      {saved && <p className="text-sm text-green-700 mt-1">Saved ✓</p>}
      {error && <p className="text-sm text-red-700 mt-1">{error}</p>}
      <p className="text-xs text-[color:var(--muted)] mt-3">
        The cron runs every 5 minutes. When the scheduled time passes, everyone
        eligible who hasn&rsquo;t been sent one yet gets the reminder. Manual
        &ldquo;Send reminder emails&rdquo; below still works any time and is
        independent of this schedule.
      </p>
    </section>
  );
}
