import Link from "next/link";
import { DashboardCard } from "@/components/admin/dashboard/Card";
import { WaitingList } from "@/components/admin/dashboard/WaitingList";
import { PulseRow } from "@/components/admin/dashboard/Pulse";
import { getDashboardData } from "@/lib/dashboard-signals";
import { unsnoozeAllAction } from "./dashboard-actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const data = await getDashboardData();
  const { eventCards, cadenceCards, waiting, pulse, totalActiveCount, snoozedCount } = data;

  const isEmpty =
    eventCards.length === 0 && cadenceCards.length === 0 && waiting.length === 0;

  const peopleWaitingTotal = waiting.reduce((a, r) => a + r.count, 0);
  const cardCount = eventCards.length + cadenceCards.length;

  return (
    <div>
      <header className="flex items-baseline justify-between gap-4 flex-wrap mb-5 sm:mb-7">
        <div>
          <h1 className="font-sans text-2xl sm:text-[32px] font-bold tracking-[-0.02em] text-[color:var(--navy-ink)] m-0 leading-[1.1]">
            What needs doing
          </h1>
          <p className="m-0 mt-1.5 text-[13px] text-[color:var(--muted)]">
            {now()}
            {!isEmpty && (
              <>
                {" · "}
                {cardCount > 0 && (
                  <>
                    {cardCount} {cardCount === 1 ? "card" : "cards"}
                  </>
                )}
                {cardCount > 0 && peopleWaitingTotal > 0 && " · "}
                {peopleWaitingTotal > 0 && (
                  <>
                    {peopleWaitingTotal} {peopleWaitingTotal === 1 ? "person" : "people"} waiting
                  </>
                )}
              </>
            )}
            {isEmpty && " · all clear"}
          </p>
        </div>
        <div className="hidden sm:flex gap-2">
          {snoozedCount > 0 && (
            <form action={unsnoozeAllAction}>
              <button
                type="submit"
                className="bg-white text-[color:var(--navy-ink)] border border-[color:var(--rule)] rounded-md px-3 py-2 text-xs font-semibold hover:border-navy"
              >
                Unsnooze all ({snoozedCount})
              </button>
            </form>
          )}
          <Link
            href="/admin/email/compose"
            className="bg-navy text-white border-0 rounded-md px-3.5 py-2 text-xs font-semibold no-underline"
          >
            Compose newsletter
          </Link>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3 sm:gap-[18px]">
          {eventCards.length > 0 && (
            <div
              className={`grid gap-2.5 sm:gap-3 ${
                eventCards.length >= 2 ? "sm:grid-cols-2" : "sm:grid-cols-1"
              }`}
            >
              {eventCards.map((c) => (
                <DashboardCard
                  key={c.id}
                  signalId={c.id}
                  severity={c.severity}
                  eyebrow={c.eyebrow}
                  eyebrowMeta={c.eyebrowMeta}
                  title={c.title}
                  meta={c.meta}
                  body={c.body}
                  primaryAction={c.primaryAction}
                  secondaryAction={c.secondaryAction}
                  checklist={c.checklist}
                />
              ))}
            </div>
          )}

          {cadenceCards.length > 0 && (
            <div
              className={`grid gap-2.5 sm:gap-3 ${
                cadenceCards.length >= 2 ? "sm:grid-cols-2" : "sm:grid-cols-1"
              }`}
            >
              {cadenceCards.map((c) => (
                <DashboardCard
                  key={c.id}
                  signalId={c.id}
                  severity={c.severity}
                  eyebrow={c.eyebrow}
                  title={c.title}
                  body={c.body}
                  primaryAction={c.primaryAction}
                />
              ))}
            </div>
          )}

          <WaitingList rows={waiting} />

          <PulseRow tiles={pulse} />
        </div>
      )}

      <p className="mt-6 sm:mt-8 text-[11px] text-[color:var(--muted)] text-center">
        Snoozed cards return when their window expires <em>and</em> the underlying state still applies.
      </p>

      <p className="mt-2 text-[11px] text-[color:var(--muted)] text-center">
        Looking for the old at-a-glance metrics?{" "}
        <Link href="/admin/analytics" className="text-navy hover:underline">
          /admin/analytics
        </Link>
        .
      </p>
    </div>
  );
}

function now(): string {
  return new Date().toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function EmptyState() {
  return (
    <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-8 sm:p-14 text-center">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3.5">
        Nothing urgent
      </div>
      <h2 className="font-sans text-[20px] sm:text-2xl font-semibold tracking-[-0.01em] text-[color:var(--navy-ink)] m-0 leading-[1.2]">
        Last reviewed {new Date().toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" })}.
      </h2>
      <p className="m-0 mt-2.5 mx-auto max-w-[440px] text-[13.5px] text-[color:var(--muted)]">
        Cards return automatically when there's a Foodies event coming up, a
        recap to write, or a request waiting.
      </p>
      <div className="mt-5 flex justify-center gap-2 flex-wrap">
        <Link
          href="/admin/events"
          className="bg-white text-[color:var(--navy-ink)] border border-[color:var(--rule)] rounded-md px-3.5 py-2 text-[13px] font-semibold no-underline hover:border-navy"
        >
          Open Events
        </Link>
        <Link
          href="/admin/alumni"
          className="bg-white text-[color:var(--navy-ink)] border border-[color:var(--rule)] rounded-md px-3.5 py-2 text-[13px] font-semibold no-underline hover:border-navy"
        >
          Open Alumni
        </Link>
      </div>
    </section>
  );
}
