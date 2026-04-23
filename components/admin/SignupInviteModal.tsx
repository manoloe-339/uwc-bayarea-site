"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const SIGNUP_URL = "https://uwcbayarea.org/signup";

function defaultSubject(): string {
  return "Join the UWC Bay Area alumni network";
}

function defaultBody(params: {
  firstName: string | null;
  eventName: string;
  uwcAffiliation: string | null;
}): string {
  const name = params.firstName?.trim() || "there";
  const affiliation = params.uwcAffiliation?.trim() || "UWC";
  return `Hi ${name},

I noticed you registered for the ${params.eventName} and mentioned you're affiliated with ${affiliation}.

You're not yet in our UWC Bay Area alumni database. Would you like to join? It takes just 2 minutes to sign up:

${SIGNUP_URL}

Once you're in our system, you'll get updates about future events and can connect with other UWC alumni in the Bay Area.

See you at the event!`;
}

type Props = {
  attendeeId: number;
  to: string;
  firstName: string | null;
  eventName: string;
  uwcAffiliation: string | null;
  alreadySentAt: string | null;
  onClose: () => void;
};

export function SignupInviteModal({
  attendeeId,
  to,
  firstName,
  eventName,
  uwcAffiliation,
  alreadySentAt,
  onClose,
}: Props) {
  const [subject, setSubject] = useState(defaultSubject());
  const [body, setBody] = useState(defaultBody({ firstName, eventName, uwcAffiliation }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const send = async () => {
    if (alreadySentAt) {
      const when = new Date(alreadySentAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      if (!confirm(`An invite was already sent on ${when}. Send again?`)) return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ticket-events/attendees/${attendeeId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, to }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Send failed");
      }
      startTransition(() => router.refresh());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-[12px] shadow-xl p-6 w-full max-w-[560px] max-h-[90vh] overflow-y-auto">
        <h2 className="font-sans font-bold text-navy text-lg mb-1">Send signup invitation</h2>
        <p className="text-xs text-[color:var(--muted)] mb-4">
          Email sent via Resend and tracked alongside regular campaigns.
          Opens and clicks show up on this attendee row.
        </p>
        {alreadySentAt && (
          <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-3 py-2">
            An invite was already sent on{" "}
            {new Date(alreadySentAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            . Sending again will record a fresh row in the history.
          </div>
        )}

        <label className="block mb-3">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            To
          </span>
          <input
            type="email"
            value={to}
            readOnly
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-ivory-2 text-[color:var(--muted)]"
          />
        </label>
        <label className="block mb-3">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Subject
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>
        <label className="block mb-4">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Message
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-mono"
          />
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
            onClick={send}
            disabled={submitting}
            className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Sending…" : alreadySentAt ? "Resend invite" : "Send invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
