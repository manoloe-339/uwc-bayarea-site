import Link from "next/link";
import { sql } from "@/lib/db";
import { verifyUnsubscribeToken, maskEmail } from "@/lib/unsubscribe-token";
import { UNSUBSCRIBE_REASONS } from "@/lib/unsubscribe-reasons";
import { confirmUnsubscribe } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Unsubscribe · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const verdict = verifyUnsubscribeToken(sp.token);

  if (!verdict.ok || sp.error) {
    return <InvalidTokenCard />;
  }

  const rows = (await sql`SELECT id, first_name, email FROM alumni WHERE id = ${verdict.alumniId}`) as {
    id: number; first_name: string | null; email: string;
  }[];
  if (rows.length === 0) return <InvalidTokenCard />;
  const r = rows[0];
  const greetingName = r.first_name ? `Hi ${r.first_name},` : "Hi there,";

  return (
    <Shell>
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-1.5">
        {greetingName} sorry to see you go.
      </h1>
      <p className="text-sm text-[color:var(--navy-ink)]">
        You're about to unsubscribe <span className="font-semibold">{maskEmail(r.email)}</span> from
        UWC Bay Area emails.
      </p>

      <form action={confirmUnsubscribe} className="mt-7 space-y-5">
        <input type="hidden" name="token" value={sp.token ?? ""} />
        <fieldset>
          <legend className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2.5">
            Mind telling us why? (optional)
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
            Anything else you'd like us to know? (optional)
          </span>
          <textarea
            name="note"
            rows={4}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            placeholder="A sentence or two — feedback is welcome."
          />
        </label>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
          <button
            type="submit"
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide"
          >
            Confirm unsubscribe
          </button>
          <Link
            href="/"
            className="text-sm text-[color:var(--muted)] hover:text-navy underline"
          >
            Actually, keep me subscribed
          </Link>
        </div>
      </form>
    </Shell>
  );
}

function InvalidTokenCard() {
  return (
    <Shell>
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-2">
        That unsubscribe link isn't valid.
      </h1>
      <p className="text-sm text-[color:var(--navy-ink)] mb-6">
        The link may be malformed or was copied incompletely. You can unsubscribe manually by entering
        your email on the fallback page.
      </p>
      <Link
        href="/unsubscribe/manual"
        className="inline-block bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold"
      >
        Unsubscribe manually
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-[560px] mx-auto px-5 sm:px-7 py-14 sm:py-20">
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-7 sm:p-9 shadow-[0_2px_0_var(--ivory-3),0_24px_60px_-30px_rgba(11,37,69,.22)]">
          {children}
        </div>
        <p className="mt-6 text-center text-[11px] tracking-[.28em] uppercase text-[color:var(--muted)]">
          UWC Bay Area
        </p>
      </div>
    </main>
  );
}
