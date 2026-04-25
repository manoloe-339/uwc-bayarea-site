"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RetryButton({ alumniId }: { alumniId: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "err">("ok");
  const [, startTransition] = useTransition();
  const router = useRouter();

  const click = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/enrichment/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? body.message ?? "Retry failed");
      }
      setTone("ok");
      setMsg("Queued — refresh in ~60s");
      startTransition(() => router.refresh());
    } catch (err) {
      setTone("err");
      setMsg(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={click}
        disabled={busy}
        className="bg-navy text-white px-3 py-1.5 rounded text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
      >
        {busy ? "Retrying…" : "Retry"}
      </button>
      {msg && (
        <span className={`text-[10px] ${tone === "ok" ? "text-green-700" : "text-red-700"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
