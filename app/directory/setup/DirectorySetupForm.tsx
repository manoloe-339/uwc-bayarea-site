"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/directory/PasswordInput";

interface Props {
  token: string;
  email: string;
}

export default function DirectorySetupForm({ token, email }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tooShort || mismatch) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/directory/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not set password.");
        return;
      }
      router.push("/directory");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
          Email
        </span>
        <input
          type="email"
          value={email}
          readOnly
          disabled
          className="w-full border border-[color:var(--rule)] rounded px-3 py-2.5 text-sm bg-[color:var(--ivory-2)] text-[color:var(--muted)]"
        />
      </label>

      <label className="block">
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
          New password
        </span>
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoFocus
          autoComplete="new-password"
          required
          minLength={8}
          errored={tooShort}
        />
        {tooShort && (
          <span className="block mt-1 text-xs text-red-700">
            Use at least 8 characters.
          </span>
        )}
      </label>

      <label className="block">
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
          Confirm password
        </span>
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
          errored={mismatch}
        />
        {mismatch && (
          <span className="block mt-1 text-xs text-red-700">
            Passwords don&rsquo;t match.
          </span>
        )}
      </label>

      {error && (
        <div role="alert" className="text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || tooShort || mismatch || !password || !confirm}
        className="w-full bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Setting up…" : "Set password & sign in"}
      </button>
    </form>
  );
}
