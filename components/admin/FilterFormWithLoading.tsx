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
        <div
          role="alertdialog"
          aria-live="assertive"
          aria-label="Searching"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
        >
          <div className="bg-white rounded-[12px] shadow-xl px-7 py-6 flex items-center gap-4 max-w-[90vw]">
            <span
              className="inline-block w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin shrink-0"
              aria-hidden
            />
            <div>
              <div className="font-sans font-bold text-navy text-base">Searching…</div>
              <div className="text-xs text-[color:var(--muted)] mt-0.5">
                AI steps can take a few seconds.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
