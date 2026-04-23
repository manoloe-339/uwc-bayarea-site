"use client";

import { useEffect, useState } from "react";

type Props = {
  attendeeId: number;
  displayName: string;
  onClose: () => void;
};

export function ViewQrCodeModal({ attendeeId, displayName, onClose }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ticket-events/attendees/${attendeeId}/qr-token`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error ?? "Could not load QR");
        }
        if (cancelled) return;
        setToken(body.token as string);
        setGenerated(!!body.generated);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attendeeId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-[12px] shadow-xl p-6 w-full max-w-[420px]">
        <h2 className="font-sans font-bold text-navy text-lg mb-1">QR code</h2>
        <p className="text-xs text-[color:var(--muted)] mb-4">
          For <strong className="text-[color:var(--navy-ink)]">{displayName}</strong>.
          Same code that appears in the reminder email.
        </p>

        <div className="bg-white border border-[color:var(--rule)] rounded p-4 flex items-center justify-center min-h-[260px]">
          {token ? (
            <img
              src={`/api/qr/${encodeURIComponent(token)}`}
              alt="Check-in QR code"
              width={240}
              height={240}
              style={{ width: 240, height: 240 }}
            />
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : (
            <p className="text-sm text-[color:var(--muted)]">Loading…</p>
          )}
        </div>

        {token && (
          <>
            <div className="mt-3 text-[10px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
              Token
            </div>
            <code className="block font-mono text-xs bg-ivory-2 border border-[color:var(--rule)] rounded px-2 py-1.5 break-all mt-1">
              {token}
            </code>
            {generated && (
              <p className="text-xs text-amber-700 mt-2">
                Note: this was the first time this attendee&rsquo;s QR was requested,
                so one was generated just now.
              </p>
            )}
          </>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          {token ? (
            <a
              href={`/api/qr/${encodeURIComponent(token)}`}
              download={`qr-${attendeeId}.png`}
              className="text-sm font-semibold text-navy hover:underline"
            >
              Download PNG
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
