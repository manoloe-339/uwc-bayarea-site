"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** When defined, the modal defaults its topic to "profile" and
   * captures this alumni_id so the admin tool can link back to the
   * profile being commented on. When omitted, the button auto-detects
   * the alumni_id from the URL pathname on open (so a single button in
   * the layout works correctly across list, profile, and saved pages). */
  alumniId?: number;
}

type Topic = "general" | "profile" | "bug";
type Status = "idle" | "sending" | "sent" | "error";

function detectAlumniIdFromPath(): number | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/directory\/(\d+)(?:\/|$)/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function FeedbackButton({ alumniId }: Props) {
  const [open, setOpen] = useState(false);
  const [detectedAlumniId, setDetectedAlumniId] = useState<number | null>(null);
  const effectiveAlumniId = alumniId ?? detectedAlumniId ?? null;
  const [topic, setTopic] = useState<Topic>(
    effectiveAlumniId ? "profile" : "general",
  );
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      // Detect alumni_id from the current URL on open (the layout
      // button has no prop; the per-profile button passes it in).
      const detected = alumniId ?? detectAlumniIdFromPath();
      setDetectedAlumniId(detected);
      // Reset to defaults each time the modal opens so a previously-
      // sent message doesn't leak into the next feedback.
      setStatus("idle");
      setError(null);
      setTopic(detected ? "profile" : "general");
      setMessage("");
      // Focus after the transition completes.
      requestAnimationFrame(() => messageRef.current?.focus());
    }
  }, [open, alumniId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/directory/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          alumni_id: topic === "profile" ? effectiveAlumniId : null,
          message: message.trim(),
          // contact_name intentionally not sent — the admin knows who
          // submitted from the session_id (per-user → user_id, shared →
          // 'shared:' tag).
          page_url:
            typeof window !== "undefined" ? window.location.pathname : null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to send feedback");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] hover:text-navy"
      >
        Feedback
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white rounded-[10px] max-w-[520px] w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
                  Feedback
                </div>
                <h2 className="font-sans font-bold text-[20px] text-[color:var(--navy-ink)] mt-1">
                  Tell us what you saw
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-[color:var(--muted)] hover:text-navy text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {status === "sent" ? (
              <div className="space-y-4">
                <p className="text-sm text-[color:var(--navy-ink)]">
                  Thanks — the admin will see this in the review queue.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <label className="block">
                  <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                    Topic
                  </span>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as Topic)}
                    className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
                  >
                    <option value="general">General comment / suggestion</option>
                    <option value="profile" disabled={!effectiveAlumniId}>
                      About this profile {effectiveAlumniId ? "" : "(open a profile to use this)"}
                    </option>
                    <option value="bug">Bug or broken link</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                    Message *
                  </span>
                  <textarea
                    ref={messageRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={4}
                    placeholder="e.g. Her LinkedIn URL goes to a dead profile."
                    className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
                  />
                </label>

                {error && (
                  <div className="text-xs text-red-700" role="alert">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-xs text-[color:var(--muted)] hover:text-navy"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === "sending" || !message.trim()}
                    className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {status === "sending" ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
