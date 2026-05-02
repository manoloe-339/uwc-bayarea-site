"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { sendJustVisitingNotification } from "./visiting-actions";

interface Props {
  /** WhatsApp join URL — the link sent to confirmed alumni in the future.
   * For now the modal is the gate, so this isn't visited from the button. */
  whatsappUrl: string | null;
  ctaLabel: string;
}

type View = "choose" | "visiting" | "sent";

export function JoinWhatsAppModal({ whatsappUrl, ctaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("choose");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    // Reset on next open
    setTimeout(() => {
      setView("choose");
      setError(null);
    }, 200);
  };

  const submitVisiting = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await sendJustVisitingNotification(formData);
      if (result.ok) {
        setView("sent");
      } else {
        setError(result.error ?? "Something went wrong. Try again?");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-[13px] font-bold tracking-[.2em] uppercase text-white bg-[#25D366] hover:opacity-90"
      >
        <WhatsAppMark className="w-4 h-4" />
        {ctaLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-whatsapp-title"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 bg-[color:var(--navy-ink)]/70 backdrop-blur-sm"
          />
          <div className="relative bg-white text-[color:var(--navy-ink)] rounded-[14px] shadow-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-3.5 right-4 text-[color:var(--muted)] hover:text-navy text-2xl leading-none w-8 h-8"
            >
              ×
            </button>

            {view === "choose" && (
              <ChooseView
                onVisiting={() => setView("visiting")}
                whatsappUrl={whatsappUrl}
              />
            )}

            {view === "visiting" && (
              <VisitingForm
                onBack={() => setView("choose")}
                onSubmit={submitVisiting}
                isPending={isPending}
                error={error}
              />
            )}

            {view === "sent" && <SentView onClose={close} />}
          </div>
        </div>
      )}
    </>
  );
}

function ChooseView({
  onVisiting, whatsappUrl,
}: {
  onVisiting: () => void;
  whatsappUrl: string | null;
}) {
  return (
    <div className="p-7 sm:p-8">
      <h2
        id="join-whatsapp-title"
        className="font-serif font-semibold text-[color:var(--navy-ink)] text-[26px] sm:text-[30px] leading-[1.1] tracking-[-0.005em] m-0"
      >
        Join the WhatsApp <em className="italic">community</em>
      </h2>
      <p className="mt-4 text-[15px] leading-[1.55] text-[color:var(--navy-ink)]/80">
        You need to be registered in our SF Bay Area alumni group first.
        Takes about two minutes — once you&rsquo;re in, we&rsquo;ll send the WhatsApp join link.
      </p>

      <div className="mt-6 space-y-3">
        <Link
          href="/signup"
          className="block w-full bg-navy text-white text-center px-6 py-3.5 rounded-full text-[12px] font-bold tracking-[.22em] uppercase hover:opacity-90"
        >
          I&rsquo;m a UWC alum — sign up →
        </Link>
        <button
          type="button"
          onClick={onVisiting}
          className="block w-full bg-white border border-[color:var(--rule)] text-navy text-center px-6 py-3.5 rounded-full text-[12px] font-bold tracking-[.22em] uppercase hover:border-navy"
        >
          Just visiting the Bay Area →
        </button>
      </div>

      {whatsappUrl && (
        <p className="mt-5 text-[12px] text-[color:var(--muted)] text-center">
          Already in the alumni database?{" "}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-navy"
          >
            Open WhatsApp directly
          </a>
          .
        </p>
      )}
    </div>
  );
}

function VisitingForm({
  onBack, onSubmit, isPending, error,
}: {
  onBack: () => void;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <form
      action={onSubmit}
      className="p-7 sm:p-8"
    >
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-[color:var(--muted)] hover:text-navy mb-3"
      >
        ← Back
      </button>
      <h2 className="font-serif font-semibold text-[color:var(--navy-ink)] text-[24px] sm:text-[28px] leading-[1.1] m-0">
        Just visiting <em className="italic">SF</em>?
      </h2>
      <p className="mt-3 text-[14px] leading-[1.5] text-[color:var(--navy-ink)]/80">
        Drop your UWC affiliation email and WhatsApp phone number — we&rsquo;ll
        add you to the group while you&rsquo;re here.
      </p>

      <div className="mt-5 space-y-3.5">
        <Field
          name="email"
          type="email"
          label="UWC affiliation email"
          placeholder="you@example.com"
          required
        />
        <Field
          name="phone"
          type="tel"
          label="WhatsApp phone (with country code)"
          placeholder="+1 555 555 5555"
          required
        />
        <label className="block">
          <span className="block text-[10px] font-bold tracking-[.22em] uppercase text-navy mb-1">
            Note (optional)
          </span>
          <textarea
            name="note"
            rows={2}
            placeholder="When you'll be in town, what brings you here, etc."
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>
      </div>

      {error && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-900 text-xs rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 w-full bg-navy text-white px-6 py-3.5 rounded-full text-[12px] font-bold tracking-[.22em] uppercase disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Send request →"}
      </button>
    </form>
  );
}

function SentView({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-8 text-center">
      <div className="text-5xl mb-3">✉️</div>
      <h2 className="font-serif font-semibold text-[color:var(--navy-ink)] text-[26px] leading-[1.1] m-0">
        Hold tight.
      </h2>
      <p className="mt-3 text-[15px] leading-[1.55] text-[color:var(--navy-ink)]/80">
        We&rsquo;ll aim to add you shortly.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 text-[11px] font-bold tracking-[.22em] uppercase text-navy border-b border-navy pb-1"
      >
        Close
      </button>
    </div>
  );
}

function Field({
  name, label, type = "text", placeholder, required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold tracking-[.22em] uppercase text-navy mb-1">
        {label}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="#fff"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.42L3 21" />
      <path
        d="M9 10c.5 2.5 2.5 4.5 5 5l1.5-1.5 2.5 1c-.3 1.4-1.6 2.5-3 2.5-3 0-7-4-7-7 0-1.4 1.1-2.7 2.5-3l1 2.5L9 10z"
        fill="#fff"
        stroke="none"
      />
    </svg>
  );
}
