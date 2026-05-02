"use client";

import { useEffect, useRef, useState } from "react";

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

export function QrScanPanel({
  token,
  onFound,
}: {
  token: string;
  onFound: (hit: Hit) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const mountedRef = useRef(false);
  const lastScanRef = useRef<string | null>(null);
  // Hold onFound in a ref so the parent's stats poll re-renders (which
  // create a fresh onFound arrow every time) don't retrigger the
  // useEffect below — restarting the camera in a tight loop crashes
  // iOS Safari with a client-side React exception.
  const onFoundRef = useRef(onFound);
  useEffect(() => {
    onFoundRef.current = onFound;
  }, [onFound]);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    const verifyAndShow = async (qr: string) => {
      // Deduplicate: the same code pinging 10 times a second is normal for
      // html5-qrcode. Ignore identical consecutive reads within 2s.
      if (lastScanRef.current === qr) return;
      lastScanRef.current = qr;
      setTimeout(() => {
        if (lastScanRef.current === qr) lastScanRef.current = null;
      }, 2000);
      setLookingUp(true);
      try {
        const res = await fetch(`/api/checkin/${token}/verify-qr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            body.error === "wrong_event"
              ? "QR code is for a different event."
              : body.error === "invalid_qr"
                ? "QR code is invalid or tampered."
                : body.error === "attendee_not_found"
                  ? "Attendee not found for this QR."
                  : body.error ?? "QR lookup failed"
          );
          setTimeout(() => setError(null), 3500);
          return;
        }
        if (cancelled) return;
        await scannerRef.current?.stop().catch(() => undefined);
        onFoundRef.current(body.hit as Hit);
      } finally {
        setLookingUp(false);
      }
    };

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled || !mountedRef.current) return;
        const scanner = new mod.Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            void verifyAndShow(decoded);
          },
          () => {
            // per-frame decode failures are expected — swallow.
          }
        );
        if (cancelled) {
          await scanner.stop().catch(() => undefined);
          return;
        }
        setStarting(false);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera permission denied. Use last-name search instead."
            : err instanceof Error
              ? err.message
              : "Unable to start camera."
        );
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        // html5-qrcode returns a promise; ignore rejection on unmount.
        s.stop().catch(() => undefined);
      }
    };
    // Intentionally only [token] — onFound is read via ref so re-renders
    // from the parent's stats poll don't restart the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div>
      <div className="bg-black rounded-[12px] overflow-hidden relative" style={{ minHeight: 300 }}>
        <div id="qr-reader" style={{ width: "100%" }} />
        {(starting || lookingUp) && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm pointer-events-none">
            {starting ? "Starting camera…" : "Looking up QR…"}
          </div>
        )}
      </div>
      <p className="text-xs text-[color:var(--muted)] text-center mt-3">
        Point the camera at the QR code in the guest&rsquo;s email.
      </p>
      {error && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
