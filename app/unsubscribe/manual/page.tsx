import Link from "next/link";
import { UNSUBSCRIBE_REASONS } from "@/lib/unsubscribe-reasons";
import { manualUnsubscribe } from "../actions";

export const metadata = {
  title: "Unsubscribe · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default function ManualUnsubscribePage() {
  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-[560px] mx-auto px-5 sm:px-7 py-14 sm:py-20">
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-7 sm:p-9 shadow-[0_2px_0_var(--ivory-3),0_24px_60px_-30px_rgba(11,37,69,.22)]">
          <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-2">
            Unsubscribe manually
          </h1>
          <p className="text-sm text-[color:var(--navy-ink)] mb-6">
            Enter the email address you'd like to unsubscribe. If it matches a record in our list, we'll
            take care of it — either way we'll show you a confirmation.
          </p>

          <form action={manualUnsubscribe} className="space-y-5">
            <label className="block">
              <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1.5">
                Email address
              </span>
              <input
                type="email"
                name="email"
                required
                autoFocus
                className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
                placeholder="you@example.com"
              />
            </label>

            <fieldset>
              <legend className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2.5">
                Reason (optional)
              </legend>
              <ul className="space-y-1.5">
                {UNSUBSCRIBE_REASONS.map((r) => (
                  <li key={r.code}>
                    <label className="flex items-start gap-2.5 text-sm">
                      <input type="radio" name="reason" value={r.code} className="mt-1" />
                      <span>{r.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            <label className="block">
              <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1.5">
                Anything else? (optional)
              </span>
              <textarea
                name="note"
                rows={3}
                className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
              />
            </label>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide"
              >
                Unsubscribe
              </button>
              <Link href="/" className="text-sm text-[color:var(--muted)] hover:text-navy underline">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
