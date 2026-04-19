import Link from "next/link";

export const metadata = {
  title: "Unsubscribed · UWC Bay Area",
  robots: { index: false, follow: false },
};

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ manual?: string }>;
}) {
  const sp = await searchParams;
  const wasManual = sp.manual === "1";

  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-[560px] mx-auto px-5 sm:px-7 py-14 sm:py-20">
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-7 sm:p-9 shadow-[0_2px_0_var(--ivory-3)]">
          <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-2">
            You've been unsubscribed.
          </h1>
          <p className="text-sm text-[color:var(--navy-ink)] mb-2">
            {wasManual
              ? "If the email you submitted was in our list, it's now unsubscribed. You won't hear from us again."
              : "You won't receive further UWC Bay Area emails."}
          </p>
          <p className="text-sm text-[color:var(--navy-ink)]">
            If this was a mistake, reply to any past email or reach out to{" "}
            <a href="mailto:manoloe@gmail.com" className="text-navy underline">
              manoloe@gmail.com
            </a>
            .
          </p>
          <div className="mt-6">
            <Link href="/" className="text-sm text-[color:var(--muted)] hover:text-navy underline">
              ← Back to uwcbayarea.org
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
