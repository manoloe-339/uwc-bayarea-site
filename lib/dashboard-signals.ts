import { sql } from "./db";

export type Severity = "grey" | "amber" | "red";

export interface BaseSignal {
  id: string;
  severity: Severity;
}

export type EventCardKind = "foodies_newsletter" | "ticketed_pre" | "recap_pending";
export type CadenceCardKind = "small_dinner" | "newsletter";

export type EventCardSignal = BaseSignal & {
  kind: EventCardKind;
  eyebrow: string;
  eyebrowMeta: string;
  title: string;
  meta: { label: string; value: string }[];
  body?: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  /** Pre-event checklist (only used by ticketed_pre). */
  checklist?: { label: string; done: boolean; next?: boolean }[];
};

export type CadenceCardSignal = BaseSignal & {
  kind: CadenceCardKind;
  eyebrow: string;
  title: string;
  body: string;
  primaryAction: { label: string; href: string };
};

export interface WaitingRow {
  id: string;
  count: number;
  label: string;
  meta: string;
  href: string;
  tone: "default" | "red";
}

export interface PulseTile {
  id: string;
  label: string;
  value: string;
  delta?: string;
  deltaDir: "up" | "down" | "flat";
  deltaTone: "default" | "amber" | "red";
  footnote?: string;
}

export interface DashboardData {
  generatedAt: string;
  reviewedLabel: string;
  eventCards: EventCardSignal[];
  cadenceCards: CadenceCardSignal[];
  waiting: WaitingRow[];
  pulse: PulseTile[];
  snoozedCount: number;
  /** Total raw cards/rows (before snooze filter), so the dashboard
   * "what needs doing" count is honest. */
  totalActiveCount: number;
}

/* ------------------------------------------------------------------ */
/* Snooze helpers                                                     */
/* ------------------------------------------------------------------ */

async function fetchActiveSnoozes(): Promise<Map<string, string>> {
  const rows = (await sql`
    SELECT signal_id, snoozed_until
    FROM dashboard_signal_snoozes
    WHERE snoozed_until > NOW()
  `) as { signal_id: string; snoozed_until: string }[];
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.signal_id, r.snoozed_until);
  return map;
}

/* ------------------------------------------------------------------ */
/* Event-driven signals                                               */
/* ------------------------------------------------------------------ */

type EventRow = {
  slug: string;
  name: string;
  date: string;
  total_tickets_sold: number;
};

async function fetchRelevantEvents(): Promise<EventRow[]> {
  return (await sql`
    SELECT slug, name, date, total_tickets_sold
    FROM events
    WHERE date >= NOW() - INTERVAL '30 days'
      AND date <= NOW() + INTERVAL '60 days'
    ORDER BY date ASC
  `) as EventRow[];
}

const FOODIES_RE = /foodies/i;

function daysFromNow(date: string): number {
  const d = new Date(date).getTime();
  const now = Date.now();
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

function fmtEventDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

async function buildFoodiesNewsletterSignal(
  e: EventRow,
  daysOut: number,
  prevFoodies: EventRow | null,
  daysSinceLastCampaign: number,
): Promise<EventCardSignal | null> {
  // Active window: 14 → 5 days out. Outside that, no nudge.
  if (daysOut > 14 || daysOut < 5) return null;
  // If a campaign was sent within the last 7 days, the newsletter has
  // probably gone out — don't nag.
  if (daysSinceLastCampaign <= 7) return null;
  const severity: Severity = daysOut <= 9 ? "red" : "amber";
  const meta: { label: string; value: string }[] = [];
  if (prevFoodies) {
    meta.push({
      label: "Last",
      value: `${fmtEventDate(prevFoodies.date)} · ${prevFoodies.name.replace(/^Foodies\s*(in|–|—|-)\s*/i, "").trim() || "previous gathering"}`,
    });
  }
  return {
    id: `foodies_newsletter:${e.slug}`,
    kind: "foodies_newsletter",
    severity,
    eyebrow: `Foodies · ${daysOut} days out`,
    eyebrowMeta: "Pre-event newsletter",
    title: `${e.name} · ${fmtEventDate(e.date)}`,
    meta,
    body: "Time to send the newsletter. Include a short writeup of last month's dinner.",
    primaryAction: {
      label: "Draft newsletter",
      href: `/admin/email/compose?subject=${encodeURIComponent(e.name)}`,
    },
    secondaryAction: { label: "Open event", href: `/admin/events/${e.slug}/edit` },
  };
}

function buildTicketedChecklistSignal(e: EventRow, daysOut: number): EventCardSignal | null {
  if (daysOut < 0 || daysOut > 30) return null;
  const inviteSent = false;
  const reminderScheduled = false;
  const checkinReady = false;
  const inviteListReady = e.total_tickets_sold > 0;
  const items = [
    { label: "Invite list finalized", done: inviteListReady },
    { label: "Invite email sent", done: inviteSent },
    { label: "Reminder email scheduled (T-3)", done: reminderScheduled },
    { label: "Day-of check-in tool prepped", done: checkinReady },
  ];
  const nextIdx = items.findIndex((it) => !it.done);
  if (nextIdx === -1) return null;
  items[nextIdx] = { ...items[nextIdx], next: true } as (typeof items)[number] & { next: boolean };
  const overdue = nextIdx === 0 && daysOut < 14;
  return {
    id: `ticketed_pre:${e.slug}`,
    kind: "ticketed_pre",
    severity: overdue ? "amber" : "grey",
    eyebrow: `${e.name.replace(/[:|–—-].*/, "").trim().slice(0, 24)} · ${daysOut} days out`,
    eyebrowMeta: "Pre-event checklist",
    title: `${e.name} · ${fmtEventDate(e.date)}`,
    meta: [
      { label: "RSVPs", value: `${e.total_tickets_sold}` },
    ],
    primaryAction: {
      label: items[nextIdx].label.startsWith("Invite list")
        ? "Build invite list"
        : items[nextIdx].label.startsWith("Invite email")
          ? "Send invite"
          : items[nextIdx].label.startsWith("Reminder")
            ? "Schedule reminder"
            : "Set up check-in",
      href: `/admin/events/${e.slug}/edit`,
    },
    secondaryAction: { label: "Open event", href: `/admin/events/${e.slug}/edit` },
    checklist: items,
  };
}

async function buildRecapSignal(e: EventRow, daysSince: number): Promise<EventCardSignal | null> {
  if (daysSince < 1 || daysSince > 21) return null;
  // Skip if any campaign was sent linking the event slug (rough heuristic
  // via subject mentioning the event name) within the last 21 days.
  const escapedName = e.name.slice(0, 40);
  const recapped = (await sql`
    SELECT 1
    FROM email_campaigns
    WHERE status = 'sent'
      AND sent_at > ${new Date(e.date).toISOString()}::timestamptz
      AND (subject ILIKE ${`%${escapedName}%`}
           OR subject ILIKE '%recap%'
           OR subject ILIKE '%how it went%')
    LIMIT 1
  `) as unknown[];
  if (recapped.length > 0) return null;
  const severity: Severity = daysSince > 14 ? "red" : daysSince > 7 ? "amber" : "grey";
  return {
    id: `recap_pending:${e.slug}`,
    kind: "recap_pending",
    severity,
    eyebrow: `${e.name.split(/\s+/).slice(0, 2).join(" ")} · ${daysSince} days ago`,
    eyebrowMeta: "Recap pending",
    title: `${e.name} · ${fmtEventDate(e.date)}`,
    meta: [
      { label: "Attended", value: `${e.total_tickets_sold || "—"}` },
      { label: "Recap", value: "None sent" },
    ],
    body: "Pull a few photos from the gallery for the recap email.",
    primaryAction: {
      label: "Draft recap",
      href: `/admin/email/compose?subject=${encodeURIComponent(`How it went · ${e.name}`)}`,
    },
    secondaryAction: { label: "View photos", href: `/events/${e.slug}/photos` },
  };
}

/* ------------------------------------------------------------------ */
/* Cadence signals                                                    */
/* ------------------------------------------------------------------ */

type LastCampaign = {
  subject: string | null;
  sent_at: string | null;
  recipient_count: number | null;
};

async function fetchLastCampaign(): Promise<LastCampaign | null> {
  const rows = (await sql`
    SELECT subject, sent_at, recipient_count
    FROM email_campaigns
    WHERE status = 'sent'
    ORDER BY sent_at DESC NULLS LAST
    LIMIT 1
  `) as LastCampaign[];
  return rows[0] ?? null;
}

function daysSince(when: string | null | undefined): number {
  if (!when) return Number.POSITIVE_INFINITY;
  return Math.round((Date.now() - new Date(when).getTime()) / (1000 * 60 * 60 * 24));
}

async function buildSmallDinnerCadenceSignal(events: EventRow[]): Promise<CadenceCardSignal | null> {
  const foodiesEvents = events.filter((e) => FOODIES_RE.test(e.name));
  const upcomingFoodies = foodiesEvents.find((e) => daysFromNow(e.date) >= 0);
  if (upcomingFoodies) return null;
  const lastFoodiesRows = (await sql`
    SELECT date FROM events
    WHERE name ILIKE '%foodies%' AND date < NOW()
    ORDER BY date DESC LIMIT 1
  `) as { date: string }[];
  const lastFoodies = lastFoodiesRows[0];
  if (!lastFoodies) return null;
  const since = daysSince(lastFoodies.date);
  if (since < 30) return null;
  return {
    id: "cadence:small_dinner",
    kind: "small_dinner",
    severity: "grey",
    eyebrow: "Cadence · Foodies",
    title: `${Math.floor(since / 7)} weeks since the last small dinner`,
    body: "Worth planning another? No Foodies on the calendar in the next 60 days.",
    primaryAction: { label: "Add a Foodies event", href: "/admin/events/new" },
  };
}

function buildNewsletterCadenceSignal(
  daysSinceLastCampaign: number,
  newSignups30d: number,
): CadenceCardSignal | null {
  if (daysSinceLastCampaign < 30) return null;
  const severity: Severity = daysSinceLastCampaign >= 60 ? "red" : "amber";
  return {
    id: "cadence:newsletter",
    kind: "newsletter",
    severity,
    eyebrow: "Cadence · Newsletter",
    title: `${daysSinceLastCampaign} days since last newsletter`,
    body:
      newSignups30d > 0
        ? `${newSignups30d} new signups since then haven't heard from you yet.`
        : "Worth a hello to keep the network warm.",
    primaryAction: { label: "Compose newsletter", href: "/admin/email/compose" },
  };
}

/* ------------------------------------------------------------------ */
/* People-waiting list                                                */
/* ------------------------------------------------------------------ */

async function fetchWaiting(): Promise<WaitingRow[]> {
  const rows: WaitingRow[] = [];

  const wa = (await sql`
    SELECT COUNT(*)::int AS n,
           EXTRACT(EPOCH FROM NOW() - MIN(created_at))::bigint AS oldest_seconds
    FROM registered_whatsapp_requests
    WHERE alumni_id IS NOT NULL AND sent_at IS NULL
  `) as { n: number; oldest_seconds: number | null }[];
  if (wa[0]?.n > 0) {
    const days = Math.max(0, Math.round((wa[0].oldest_seconds ?? 0) / 86400));
    rows.push({
      id: "waiting:whatsapp",
      count: wa[0].n,
      label: "WhatsApp invites pending",
      meta: days <= 1 ? "fresh" : `oldest ${days} days`,
      href: "/admin/tools/whatsapp?tab=requests",
      tone: "default",
    });
  }

  const v = (await sql`
    SELECT COUNT(*)::int AS n,
           EXTRACT(EPOCH FROM NOW() - MIN(created_at))::bigint AS oldest_seconds
    FROM visiting_requests WHERE contacted_at IS NULL
  `) as { n: number; oldest_seconds: number | null }[];
  if (v[0]?.n > 0) {
    const days = Math.max(0, Math.round((v[0].oldest_seconds ?? 0) / 86400));
    rows.push({
      id: "waiting:visiting",
      count: v[0].n,
      label: "Visiting requests waiting",
      meta: days <= 1 ? "fresh" : `oldest ${days} days`,
      href: "/admin/tools/whatsapp?tab=visiting",
      tone: "default",
    });
  }

  const vol = (await sql`
    SELECT COUNT(*)::int AS n,
           EXTRACT(EPOCH FROM NOW() - MIN(created_at))::bigint AS oldest_seconds
    FROM volunteer_signups WHERE contacted_at IS NULL
  `) as { n: number; oldest_seconds: number | null }[];
  if (vol[0]?.n > 0) {
    const days = Math.max(0, Math.round((vol[0].oldest_seconds ?? 0) / 86400));
    rows.push({
      id: "waiting:volunteer",
      count: vol[0].n,
      label: vol[0].n === 1 ? "Volunteer-interest submission" : "Volunteer-interest submissions",
      meta: days <= 1 ? "submitted recently" : `oldest ${days} days`,
      href: "/admin/help-out",
      tone: "default",
    });
  }

  const spam = (await sql`
    SELECT COUNT(DISTINCT alumni_id)::int AS n
    FROM email_sends
    WHERE status = 'complained'
      AND complained_at > NOW() - INTERVAL '30 days'
  `) as { n: number }[];
  if (spam[0]?.n > 0) {
    rows.push({
      id: "waiting:spam",
      count: spam[0].n,
      label: "Spam complaints in last 30 days",
      meta: "review deliverability",
      href: "/admin/email/campaigns?view=other&kind=all",
      tone: "red",
    });
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/* Pulse                                                              */
/* ------------------------------------------------------------------ */

async function fetchPulse(lastCampaign: LastCampaign | null): Promise<PulseTile[]> {
  const subRows = (await sql`
    SELECT COUNT(*)::int AS n FROM alumni
    WHERE (subscribed IS DISTINCT FROM FALSE) AND email_invalid IS NOT TRUE
  `) as { n: number }[];
  const subscribed = subRows[0]?.n ?? 0;

  const newSignupRows = (await sql`
    SELECT
      SUM((submitted_at >= NOW() - INTERVAL '30 days')::int)::int AS this_30d,
      SUM((submitted_at >= NOW() - INTERVAL '60 days' AND submitted_at < NOW() - INTERVAL '30 days')::int)::int AS prior_30d
    FROM alumni
    WHERE 'signup_form' = ANY(sources)
  `) as { this_30d: number | null; prior_30d: number | null }[];
  const this30 = newSignupRows[0]?.this_30d ?? 0;
  const prior30 = newSignupRows[0]?.prior_30d ?? 0;

  const openRows = (await sql`
    SELECT
      SUM((sent_at >= NOW() - INTERVAL '30 days')::int)::int AS sent_now,
      SUM((sent_at >= NOW() - INTERVAL '30 days' AND opened_at IS NOT NULL)::int)::int AS opened_now,
      SUM((sent_at >= NOW() - INTERVAL '60 days' AND sent_at < NOW() - INTERVAL '30 days')::int)::int AS sent_prior,
      SUM((sent_at >= NOW() - INTERVAL '60 days' AND sent_at < NOW() - INTERVAL '30 days' AND opened_at IS NOT NULL)::int)::int AS opened_prior
    FROM email_sends WHERE status = 'sent'
  `) as {
    sent_now: number | null;
    opened_now: number | null;
    sent_prior: number | null;
    opened_prior: number | null;
  }[];
  const sentNow = openRows[0]?.sent_now ?? 0;
  const openedNow = openRows[0]?.opened_now ?? 0;
  const sentPrior = openRows[0]?.sent_prior ?? 0;
  const openedPrior = openRows[0]?.opened_prior ?? 0;
  const openRateNow = sentNow ? Math.round((100 * openedNow) / sentNow) : 0;
  const openRatePrior = sentPrior ? Math.round((100 * openedPrior) / sentPrior) : 0;
  const openRateDelta = openRatePrior > 0 ? openRateNow - openRatePrior : 0;
  const openRateTone: "default" | "amber" | "red" =
    sentNow === 0 ? "default" : openRateNow < 40 ? "red" : openRateNow < 50 ? "amber" : "default";

  let lastCampaignTile: PulseTile;
  if (lastCampaign?.sent_at) {
    const since = daysSince(lastCampaign.sent_at);
    let openPct: string | undefined;
    const camp = (await sql`
      SELECT COUNT(*)::int AS sent, SUM((opened_at IS NOT NULL)::int)::int AS opened
      FROM email_sends
      WHERE campaign_id = (SELECT id FROM email_campaigns WHERE sent_at = ${lastCampaign.sent_at} LIMIT 1)
    `) as { sent: number; opened: number | null }[];
    if (camp[0]?.sent) {
      openPct = `${Math.round((100 * (camp[0].opened ?? 0)) / camp[0].sent)}% open`;
    }
    lastCampaignTile = {
      id: "pulse:last_campaign",
      label: "Last campaign",
      value: new Date(lastCampaign.sent_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      delta: openPct,
      deltaDir: "flat",
      deltaTone: since >= 30 ? "amber" : "default",
      footnote: lastCampaign.subject ? `“${lastCampaign.subject}”` : `${since} days ago`,
    };
  } else {
    lastCampaignTile = {
      id: "pulse:last_campaign",
      label: "Last campaign",
      value: "—",
      deltaDir: "flat",
      deltaTone: "default",
      footnote: "Nothing sent yet",
    };
  }

  return [
    {
      id: "pulse:subscribed",
      label: "Subscribed alumni",
      value: subscribed.toLocaleString(),
      delta: this30 > 0 ? `+${this30} this month` : "no new signups",
      deltaDir: this30 > 0 ? "up" : "flat",
      deltaTone: "default",
      footnote: prior30 > 0 ? `vs +${prior30} the prior 30 days` : undefined,
    },
    {
      id: "pulse:open_rate",
      label: "30-day open rate",
      value: sentNow ? `${openRateNow}%` : "—",
      delta:
        openRateDelta === 0
          ? sentNow
            ? "flat vs prior 30d"
            : undefined
          : `${openRateDelta > 0 ? "+" : ""}${openRateDelta} pts vs prior 30d`,
      deltaDir: openRateDelta > 0 ? "up" : openRateDelta < 0 ? "down" : "flat",
      deltaTone: openRateTone,
      footnote:
        openRateTone === "amber"
          ? "Tints amber under 50%. Compose habits drive this."
          : openRateTone === "red"
            ? "Tints red under 40%. Check deliverability fundamentals."
            : sentNow
              ? `${sentNow} emails sent in last 30d`
              : "No sends in the last 30 days",
    },
    lastCampaignTile,
  ];
}

/* ------------------------------------------------------------------ */
/* Top-level builder                                                  */
/* ------------------------------------------------------------------ */

export async function getDashboardData(): Promise<DashboardData> {
  const [snoozes, events, lastCampaign] = await Promise.all([
    fetchActiveSnoozes(),
    fetchRelevantEvents(),
    fetchLastCampaign(),
  ]);

  const dsl = daysSince(lastCampaign?.sent_at);
  const newSignupRows = (await sql`
    SELECT COUNT(*)::int AS n FROM alumni
    WHERE 'signup_form' = ANY(sources)
      AND submitted_at >= ${lastCampaign?.sent_at ?? new Date(0).toISOString()}::timestamptz
  `) as { n: number }[];
  const newSignupsSinceCampaign = newSignupRows[0]?.n ?? 0;

  const eventCards: EventCardSignal[] = [];

  // Most-recent past Foodies, used for the "Last:" line on the
  // upcoming-Foodies newsletter prompt.
  const lastFoodiesPastRows = (await sql`
    SELECT slug, name, date, total_tickets_sold FROM events
    WHERE name ILIKE '%foodies%' AND date < NOW()
    ORDER BY date DESC LIMIT 1
  `) as EventRow[];
  const lastFoodiesPast = lastFoodiesPastRows[0] ?? null;

  for (const e of events) {
    const dOut = daysFromNow(e.date);
    const isFoodies = FOODIES_RE.test(e.name);
    if (isFoodies && dOut >= 0) {
      const sig = await buildFoodiesNewsletterSignal(e, dOut, lastFoodiesPast, dsl);
      if (sig) eventCards.push(sig);
    } else if (!isFoodies && dOut >= 0) {
      const sig = buildTicketedChecklistSignal(e, dOut);
      if (sig) eventCards.push(sig);
    } else if (!isFoodies && dOut < 0) {
      const sig = await buildRecapSignal(e, -dOut);
      if (sig) eventCards.push(sig);
    }
  }

  const cadenceCards: CadenceCardSignal[] = [];
  const smallDinner = await buildSmallDinnerCadenceSignal(events);
  if (smallDinner) cadenceCards.push(smallDinner);
  const newsletterCadence = buildNewsletterCadenceSignal(dsl, newSignupsSinceCampaign);
  if (newsletterCadence) cadenceCards.push(newsletterCadence);

  const waiting = await fetchWaiting();
  const pulse = await fetchPulse(lastCampaign);

  // Filter out snoozed signals (cards only — pulse + waiting always
  // show, since they're aggregates not individual asks).
  const filteredEventCards = eventCards.filter((c) => !snoozes.has(c.id));
  const filteredCadenceCards = cadenceCards.filter((c) => !snoozes.has(c.id));
  const snoozedCount =
    eventCards.length - filteredEventCards.length +
    (cadenceCards.length - filteredCadenceCards.length);

  // Sort within each zone by severity: red → amber → grey.
  const sevOrder: Record<Severity, number> = { red: 0, amber: 1, grey: 2 };
  filteredEventCards.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  filteredCadenceCards.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  const totalActiveCount =
    filteredEventCards.length + filteredCadenceCards.length + waiting.reduce((a, r) => a + r.count, 0);

  return {
    generatedAt: new Date().toISOString(),
    reviewedLabel: new Date().toLocaleString("en-US", {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
    }),
    eventCards: filteredEventCards,
    cadenceCards: filteredCadenceCards,
    waiting,
    pulse,
    snoozedCount,
    totalActiveCount,
  };
}

export async function snoozeSignal(signalId: string, days: number): Promise<void> {
  if (!signalId || !Number.isFinite(days) || days <= 0 || days > 365) return;
  await sql`
    INSERT INTO dashboard_signal_snoozes (signal_id, snoozed_until, snoozed_at)
    VALUES (
      ${signalId},
      NOW() + (${days} || ' days')::interval,
      NOW()
    )
    ON CONFLICT (signal_id) DO UPDATE SET
      snoozed_until = EXCLUDED.snoozed_until,
      snoozed_at    = EXCLUDED.snoozed_at
  `;
}

export async function unsnoozeAll(): Promise<void> {
  await sql`DELETE FROM dashboard_signal_snoozes WHERE snoozed_until > NOW()`;
}
