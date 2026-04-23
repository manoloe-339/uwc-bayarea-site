import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug, listAttendeesForEvent, type AttendeeRecord } from "@/lib/events-db";
import { SyncStripeButton } from "@/components/admin/SyncStripeButton";
import { AttendeeRowActions } from "@/components/admin/AttendeeRowActions";
import { AddSpecialGuestButton } from "@/components/admin/AddSpecialGuestButton";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Tab = "all" | "paid" | "comp" | "review" | "starred" | "followup" | "unmatched";

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtMoney(s: string | number | null, decimals = 2): string {
  const n = s == null ? 0 : Number(s);
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toFixed(decimals)}`;
}

function filterForTab(tab: Tab, rows: AttendeeRecord[]): AttendeeRecord[] {
  switch (tab) {
    case "paid":
      return rows.filter((r) => r.attendee_type === "paid");
    case "comp":
      return rows.filter((r) => r.attendee_type === "comp");
    case "review":
      return rows.filter((r) => r.match_status === "needs_review");
    case "starred":
      return rows.filter((r) => r.is_starred);
    case "followup":
      return rows.filter((r) => r.needs_followup);
    case "unmatched":
      return rows.filter((r) => r.match_status === "unmatched");
    case "all":
    default:
      return rows;
  }
}

export default async function AttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: tabParam } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  const rows = await listAttendeesForEvent(event.id);

  const tab = (["all", "paid", "comp", "review", "starred", "followup", "unmatched"].includes(tabParam ?? "")
    ? tabParam
    : "all") as Tab;
  const visible = filterForTab(tab, rows);

  const counts = {
    all: rows.length,
    paid: rows.filter((r) => r.attendee_type === "paid").length,
    comp: rows.filter((r) => r.attendee_type === "comp").length,
    review: rows.filter((r) => r.match_status === "needs_review").length,
    starred: rows.filter((r) => r.is_starred).length,
    followup: rows.filter((r) => r.needs_followup).length,
    unmatched: rows.filter((r) => r.match_status === "unmatched").length,
  };
  const matched = rows.filter((r) => r.alumni_id != null).length;
  const matchedPct = rows.length === 0 ? 0 : Math.round((matched / rows.length) * 100);

  const paidRows = rows.filter((r) => r.attendee_type === "paid");
  const totalRevenue = paidRows.reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);
  const avgTicket = paidRows.length > 0 ? totalRevenue / paidRows.length : 0;
  const basePrice = event.ticket_price == null ? null : Number(event.ticket_price);

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/ticket-events" className="text-[color:var(--muted)] hover:text-navy">
          ← Ticket events
        </Link>
      </div>

      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">{event.name}</h1>
          <p className="text-[color:var(--muted)] text-sm">
            {new Date(event.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            {event.time ? ` · ${event.time}` : ""}
            {event.location ? ` · ${event.location}` : ""}
            {" · "}
            <Link href={`/admin/ticket-events/${slug}/edit`} className="hover:text-navy underline">
              Edit
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AddSpecialGuestButton slug={slug} />
          <a
            href={`/api/ticket-events/${slug}/export`}
            className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
          >
            Export CSV
          </a>
          <SyncStripeButton slug={slug} lastSyncedAt={event.updated_at} />
        </div>
      </div>

      {/* Stats */}
      <section className="grid sm:grid-cols-4 gap-3 mb-3">
        <Stat label="Total registered" value={rows.length} />
        <Stat label="Paid" value={counts.paid} />
        <Stat label="Special guests" value={counts.comp} />
        <Stat label="Matched to alumni" value={`${matched} (${matchedPct}%)`} accent={matched < rows.length} />
      </section>
      <section className="grid sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Total revenue" value={fmtMoney(totalRevenue)} />
        <Stat label="Average ticket" value={paidRows.length > 0 ? fmtMoney(avgTicket) : "—"} />
        <Stat label="Base price (Stripe)" value={basePrice != null ? fmtMoney(basePrice) : "—"} />
      </section>

      {(counts.review > 0 || counts.unmatched > 0 || counts.followup > 0) && (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 mb-6 text-sm">
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">Needs attention</div>
          <ul className="flex flex-wrap gap-4 text-[color:var(--muted)]">
            {counts.review > 0 && <li>⚠ {counts.review} needs review</li>}
            {counts.unmatched > 0 && <li>✗ {counts.unmatched} unmatched</li>}
            {counts.followup > 0 && <li>🚩 {counts.followup} follow-up</li>}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 text-sm font-semibold">
        <Tab href={`/admin/ticket-events/${slug}/attendees?tab=all`} active={tab === "all"} count={counts.all}>All</Tab>
        <Tab href={`/admin/ticket-events/${slug}/attendees?tab=paid`} active={tab === "paid"} count={counts.paid}>Paid</Tab>
        <Tab href={`/admin/ticket-events/${slug}/attendees?tab=comp`} active={tab === "comp"} count={counts.comp}>Special guests</Tab>
        <Tab href={`/admin/ticket-events/${slug}/attendees?tab=review`} active={tab === "review"} count={counts.review}>Needs review</Tab>
        <Tab href={`/admin/ticket-events/${slug}/attendees?tab=unmatched`} active={tab === "unmatched"} count={counts.unmatched}>Unmatched</Tab>
        <Tab href={`/admin/ticket-events/${slug}/attendees?tab=starred`} active={tab === "starred"} count={counts.starred}>Starred</Tab>
        <Tab href={`/admin/ticket-events/${slug}/attendees?tab=followup`} active={tab === "followup"} count={counts.followup}>Follow-up</Tab>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-8 text-center text-sm text-[color:var(--muted)]">
          Nothing in this view.
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => (
            <AttendeeRow key={a.id} a={a} basePrice={basePrice} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AttendeeRow({ a, basePrice }: { a: AttendeeRecord; basePrice: number | null }) {
  const displayName =
    [a.alumni_first_name, a.alumni_last_name].filter(Boolean).join(" ") ||
    a.stripe_customer_name ||
    a.stripe_customer_email ||
    "Unknown";
  const email = a.alumni_email ?? a.stripe_customer_email ?? "—";
  const photo = a.alumni_photo_url;
  const initial = (displayName[0] ?? "?").toUpperCase();

  return (
    <li className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 flex gap-3 text-sm">
      <div className="shrink-0">
        {photo ? (
          <img
            src={photo}
            alt=""
            className="w-11 h-11 rounded-full object-cover bg-ivory-2 border border-[color:var(--rule)]"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-ivory-2 border border-[color:var(--rule)] flex items-center justify-center text-[color:var(--muted)] font-sans font-bold">
            {initial}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {a.alumni_id ? (
            <Link
              href={`/admin/alumni/${a.alumni_id}`}
              className="font-semibold text-navy hover:underline"
            >
              {displayName}
            </Link>
          ) : (
            <span className="font-semibold text-[color:var(--navy-ink)]">{displayName}</span>
          )}
          {a.attendee_type === "comp" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 uppercase tracking-wider font-bold">
              Comp
            </span>
          )}
          {a.refund_status && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-800 uppercase tracking-wider font-bold">
              {a.refund_status === "refunded" ? "Refunded" : "Partial refund"}
            </span>
          )}
          {a.is_starred && <span className="text-amber-500" aria-label="VIP">⭐</span>}
          {a.needs_followup && <span className="text-orange-600" aria-label="Follow-up">🚩</span>}
          <MatchBadge status={a.match_status} confidence={a.match_confidence} />
        </div>
        <div className="text-xs text-[color:var(--muted)] mt-0.5">
          {email}
          {a.alumni_uwc_college ? ` · ${a.alumni_uwc_college}${a.alumni_grad_year ? ` '${String(a.alumni_grad_year).slice(-2)}` : ""}` : ""}
        </div>
        <div className="text-xs text-[color:var(--muted)] mt-0.5">
          {a.paid_at ? fmtDateTime(a.paid_at) : "—"}
          {a.match_reason ? ` · ${a.match_reason}` : ""}
        </div>
        {a.notes && (
          <div className="mt-1 text-xs italic text-[color:var(--navy-ink)] bg-ivory-2 border-l-2 border-navy pl-2 py-1 rounded-r">
            {a.notes}
          </div>
        )}
      </div>
      <PaidAmount
        amount={Number(a.amount_paid || 0)}
        attendeeType={a.attendee_type}
        refundStatus={a.refund_status}
        basePrice={basePrice}
      />
      <AttendeeRowActions
        attendeeId={a.id}
        initialNotes={a.notes}
        initialStarred={a.is_starred}
        initialFollowup={a.needs_followup}
        alumniId={a.alumni_id}
        stripeName={a.stripe_customer_name}
        stripeEmail={a.stripe_customer_email}
        matchReason={a.match_reason}
      />
    </li>
  );
}

function PaidAmount({
  amount,
  attendeeType,
  refundStatus,
  basePrice,
}: {
  amount: number;
  attendeeType: AttendeeRecord["attendee_type"];
  refundStatus: string | null;
  basePrice: number | null;
}) {
  if (attendeeType === "comp") {
    return (
      <div className="shrink-0 text-right">
        <div className="text-sm font-sans font-bold text-indigo-800">Comp</div>
        <div className="text-[10px] text-[color:var(--muted)]">$0</div>
      </div>
    );
  }
  const label = refundStatus === "refunded"
    ? null
    : basePrice != null && basePrice > 0 && Math.abs(amount - basePrice) > 0.005
      ? amount > basePrice
        ? `+${fmtMoney(amount - basePrice)} donation`
        : `${fmtMoney(amount - basePrice)} off`
      : null;
  const tone = refundStatus === "refunded"
    ? "text-red-700 line-through"
    : amount > (basePrice ?? 0)
      ? "text-emerald-700"
      : "text-navy";
  return (
    <div className="shrink-0 text-right min-w-[80px]">
      <div className={`text-base font-sans font-bold tabular-nums ${tone}`}>
        {fmtMoney(amount)}
      </div>
      {label && (
        <div className={`text-[10px] font-semibold ${amount > (basePrice ?? 0) ? "text-emerald-700" : "text-amber-700"}`}>
          {label}
        </div>
      )}
    </div>
  );
}

function MatchBadge({
  status,
  confidence,
}: {
  status: AttendeeRecord["match_status"];
  confidence: AttendeeRecord["match_confidence"];
}) {
  if (status === "matched") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 border border-green-200 text-green-800 uppercase tracking-wider font-bold">
        ✓ Matched{confidence ? ` (${confidence})` : ""}
      </span>
    );
  }
  if (status === "needs_review") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 uppercase tracking-wider font-bold">
        ⚠ Review{confidence ? ` (${confidence})` : ""}
      </span>
    );
  }
  if (status === "unmatched") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-800 uppercase tracking-wider font-bold">
        ✗ No match
      </span>
    );
  }
  return null;
}

function Tab({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded border ${
        active
          ? "bg-navy text-white border-navy"
          : "bg-white text-navy border-[color:var(--rule)] hover:border-navy"
      }`}
    >
      {children}{" "}
      <span className={`text-xs ${active ? "text-white/70" : "text-[color:var(--muted)]"}`}>
        ({count})
      </span>
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div
      className={`bg-white border ${
        accent ? "border-orange-300" : "border-[color:var(--rule)]"
      } rounded-[10px] p-4`}
    >
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-2xl font-sans font-bold text-[color:var(--navy-ink)] mt-1">{value}</div>
    </div>
  );
}
