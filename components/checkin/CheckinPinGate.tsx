"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  token: string;
  eventName: string;
};

export function CheckinPinGate({ token, eventName }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/checkin/${token}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Wrong PIN");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wrong PIN");
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="bg-white border border-[color:var(--rule)] rounded-[12px] p-8 w-full max-w-[440px]">
        <h1 className="font-sans font-bold text-navy text-2xl mb-1">{eventName}</h1>
        <p className="text-sm text-[color:var(--muted)] mb-6">Enter PIN to continue:</p>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pin.length === 4) submit();
          }}
          placeholder="••••"
          autoFocus
          className="w-full text-center text-3xl tracking-[0.5em] font-sans font-bold text-navy border border-[color:var(--rule)] rounded px-3 py-4 bg-white mb-3"
        />
        {error && <div className="text-sm text-red-700 text-center mb-3">{error}</div>}
        <button
          type="button"
          onClick={submit}
          disabled={pin.length !== 4 || submitting}
          className="w-full bg-navy text-white px-6 py-3 rounded text-base font-semibold disabled:opacity-40"
        >
          {submitting ? "Checking…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
