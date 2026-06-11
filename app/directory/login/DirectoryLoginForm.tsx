"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import PasswordInput from "@/components/directory/PasswordInput";

interface Props {
  next: string;
  /** True when the surrounding card is visible. We delay focus on
   * the email field until this flips true — otherwise iOS Safari
   * sees the autofocused input inside the off-screen card on page
   * load and pops up the keyboard + autofill chip over the
   * backdrop, ruining the first impression. */
  shouldFocus?: boolean;
}

const INPUT_CLASS =
  "w-full bg-white border-[1.5px] border-[color:var(--rule)] rounded-[9px] " +
  "px-3 py-[10px] text-[14px] text-[color:var(--navy-ink)] placeholder:text-[color:var(--muted-2)] " +
  "transition focus:outline-none focus:border-[color:var(--navy)] " +
  "focus:[box-shadow:0_0_0_3px_rgba(2,101,168,.14)]";

const PASSWORD_CLASS = INPUT_CLASS + " pr-[66px]";

const LABEL_CLASS =
  "block text-[10px] tracking-[.18em] uppercase font-bold " +
  "text-[color:var(--muted)] mb-[6px] mt-[10px]";

export default function DirectoryLoginForm({ next, shouldFocus }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);

  // Focus the email field only after the card actually becomes
  // visible. Page load doesn't trigger keyboard / autofill UI.
  useEffect(() => {
    if (!shouldFocus) return;
    const t = setTimeout(() => emailRef.current?.focus(), 360);
    return () => clearTimeout(t);
  }, [shouldFocus]);

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
      // Full reload so middleware sees the freshly-set Set-Cookie
      // header — router.push() can race with cookie propagation.
      window.location.href = data.next ?? "/directory";
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="block">
        <span className={LABEL_CLASS}>Email</span>
        <input
          ref={emailRef}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="your@email.com"
          className={INPUT_CLASS}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Password</span>
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
          inputClassName={PASSWORD_CLASS}
        />
      </label>

      {error && (
        <div role="alert" className="text-sm text-red-700 mt-1">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !password}
        className="mt-[18px] w-full bg-navy text-white rounded-[9px] py-[11px] text-[14px] font-bold transition hover:brightness-110 active:scale-[.985] disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <div className="text-center mt-3">
        <a
          href="/directory/forgot"
          className="text-[11px] text-[color:var(--muted)] hover:text-navy underline decoration-dotted"
        >
          Forgot password?
        </a>
      </div>
    </form>
  );
}
