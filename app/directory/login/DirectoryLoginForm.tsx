"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/directory/PasswordInput";

interface Props {
  next: string;
}

export default function DirectoryLoginForm({ next }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/directory/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      const data = (await res.json()) as { next?: string };
      router.push(data.next ?? "/directory");
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
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          autoComplete="email"
          placeholder="your@email.com"
          className="w-full border border-[color:var(--rule)] rounded px-3 py-2.5 text-sm bg-white"
        />
        <span className="block mt-1 text-xs text-[color:var(--muted)]">
          Leave blank if you were given a shared admin password.
        </span>
      </label>
      <label className="block">
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
          Password
        </span>
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <div role="alert" className="text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending || !password}
        className="w-full bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
