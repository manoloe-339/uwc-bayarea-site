"use client";

import { useState, useTransition } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/directory/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't send the reset email.");
        return;
      }
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="text-[13px] text-[color:var(--navy-ink)] leading-snug bg-emerald-50 border border-emerald-200 rounded p-3">
        ✓ If that email is on file, we&rsquo;ve sent a reset link. It expires in
        7 days. Check your inbox (and the spam folder).
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
          Email
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          autoComplete="email"
          required
          placeholder="your@email.com"
          className="w-full border border-[color:var(--rule)] rounded px-3 py-2.5 text-sm bg-white"
        />
      </label>
      {error && (
        <div role="alert" className="text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending || !email.trim()}
        className="w-full bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
