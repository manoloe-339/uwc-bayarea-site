"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  formKey?: string;
};

/**
 * Client-side wrapper for the alumni filter form. Intercepts submission,
 * programmatically navigates (so useTransition can track the server-render
 * wait), and renders a "Searching…" indicator while the new page loads.
 *
 * Preserves GET-param semantics — the new URL is built from the form's
 * fields, identical to a plain <form method="GET"> submit.
 */
export function FilterFormWithLoading({ children, className, formKey }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (!s) continue;
      // Deduplicate on identical repeated k=v pairs (e.g. same id picked twice)
      const existing = params.getAll(k);
      if (existing.includes(s)) continue;
      params.append(k, s);
    }
    const qs = params.toString();
    const href = qs ? `/admin/alumni?${qs}` : "/admin/alumni";
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <>
      <form key={formKey} onSubmit={onSubmit} method="GET" className={className}>
        {children}
      </form>
      {pending && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-navy border-t-transparent rounded-full animate-spin" aria-hidden />
          <span className="font-semibold text-navy">Searching…</span>
          <span className="text-[color:var(--muted)]">AI steps may take a few seconds.</span>
        </div>
      )}
    </>
  );
}
