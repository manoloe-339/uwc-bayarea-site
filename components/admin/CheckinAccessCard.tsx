"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  slug: string;
  token: string | null;
  pin: string | null;
  generatedAt: string | null;
};

export function CheckinAccessCard({ slug, token, pin, generatedAt }: Props) {
  const [pending, setPending] = useState<null | "generate" | "pin" | "clear">(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();

  const checkinUrl =
    typeof window !== "undefined" && token
      ? `${window.location.origin}/events/${slug}/checkin/${token}`
      : token
        ? `/events/${slug}/checkin/${token}`
        : null;

  const post = async (body: object, which: typeof pending) => {
    setPending(which);
    setError(null);
    try {
      const res = await fetch(`/api/ticket-events/${slug}/checkin-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Failed");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(null);
    }
  };

  const generate = () => post({ action: "generate" }, "generate");
  const regenerate = () => {
    if (
      !confirm(
        "This will break any open volunteer browser tabs using the old link. Regenerate?"
      )
    )
      return;
    post({ action: "regenerate" }, "generate");
  };
  const savePin = () => {
    const raw = pinInput.trim();
    if (raw && !/^\d{4}$/.test(raw)) {
      setError("PIN must be exactly 4 digits");
      return;
    }
    post({ action: "set_pin", pin: raw || null }, "pin").then(() => {
      setEditingPin(false);
      setPinInput("");
    });
  };
  const clearAll = () => {
    if (!confirm("Clear the check-in link and PIN? Volunteers will lose access until you generate a new link.")) return;
    post({ action: "clear" }, "clear");
  };

  const copy = async () => {
    if (!checkinUrl) return;
    try {
      await navigator.clipboard.writeText(checkinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard blocked — select the URL and copy manually.");
    }
  };

  return (
    <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
        Check-in access
      </div>

      {!token ? (
        <>
          <p className="text-sm text-[color:var(--muted)] mb-3">
            Generate a shareable link volunteers can open on their phone to
            check people in. No login required.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={pending !== null}
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-60"
          >
            {pending === "generate" ? "Generating…" : "Generate check-in link"}
          </button>
        </>
      ) : (
        <>
          <div className="text-xs text-[color:var(--muted)] mb-1">Share with volunteers:</div>
          <div className="flex flex-wrap gap-2 mb-3">
            <code className="font-mono text-xs bg-ivory-2 border border-[color:var(--rule)] rounded px-2 py-1.5 break-all flex-1 min-w-[240px]">
              {checkinUrl ?? "…"}
            </code>
            <button
              type="button"
              onClick={copy}
              className="text-sm font-semibold text-navy border border-navy px-3 py-1.5 rounded hover:bg-navy hover:text-white"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={regenerate}
              disabled={pending !== null}
              className="text-sm text-[color:var(--muted)] hover:text-navy disabled:opacity-60"
            >
              {pending === "generate" ? "Regenerating…" : "Regenerate"}
            </button>
            <span className="text-[color:var(--muted)]">·</span>
            {editingPin ? (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="4 digits"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="border border-[color:var(--rule)] rounded px-2 py-1 text-sm bg-white w-[90px]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={savePin}
                  disabled={pending === "pin"}
                  className="text-sm font-semibold text-navy hover:underline disabled:opacity-60"
                >
                  Save PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPin(false);
                    setPinInput("");
                    setError(null);
                  }}
                  className="text-sm text-[color:var(--muted)] hover:text-navy"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPin(true);
                    setPinInput(pin ?? "");
                  }}
                  className="text-sm text-[color:var(--muted)] hover:text-navy"
                >
                  {pin ? `PIN: ${pin} — change` : "Set a PIN (optional)"}
                </button>
                {pin && (
                  <button
                    type="button"
                    onClick={() => post({ action: "set_pin", pin: null }, "pin")}
                    className="text-sm text-[color:var(--muted)] hover:text-navy"
                  >
                    Remove PIN
                  </button>
                )}
              </>
            )}
            <span className="text-[color:var(--muted)]">·</span>
            <button
              type="button"
              onClick={clearAll}
              disabled={pending !== null}
              className="text-sm text-red-700 hover:underline disabled:opacity-60"
            >
              Clear
            </button>
          </div>
          {generatedAt && (
            <div className="text-xs text-[color:var(--muted)]">
              Generated{" "}
              {new Date(generatedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}
        </>
      )}
      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
    </section>
  );
}
