"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/directory/PasswordInput";
import {
  DIRECTORY_TOS_HEADING,
  DIRECTORY_TOS_LINES,
} from "@/lib/directory-tos";

interface Props {
  token: string;
  email: string;
}

export default function DirectorySetupForm({ token, email }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tooShort || mismatch || !agreed) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/directory/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, tos_accepted: true }),
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
        <span className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
            New password
          </span>
          <span className="text-[10px] text-[color:var(--muted)] normal-case tracking-normal">
            min 8 chars
          </span>
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

      <label className="block bg-[color:var(--ivory-2)] rounded px-3 py-2.5 cursor-pointer">
        <span className="flex items-start gap-2 text-[12px] leading-snug text-[color:var(--navy-ink)]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-navy"
            required
          />
          <span className="flex-1">
            <span className="block font-bold text-[11px] tracking-[.18em] uppercase text-navy mb-1">
              {DIRECTORY_TOS_HEADING}
            </span>
            <ul className="list-disc pl-4 space-y-0.5 text-[12px]">
              {DIRECTORY_TOS_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </span>
        </span>
      </label>

      {error && (
        <div role="alert" className="text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={
          pending || tooShort || mismatch || !password || !confirm || !agreed
        }
        className="w-full bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Setting up…" : "Set password & sign in"}
      </button>
    </form>
  );
}
