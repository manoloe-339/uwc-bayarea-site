import { Redis } from "@upstash/redis";
import { sql as pg } from "./db";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const TZ = "America/Los_Angeles";

function dayKey(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

function normalizePath(path: string): string {
  if (!path) return "/";
  const trimmed = path.split("?")[0].split("#")[0];
  const collapsed = trimmed.replace(/\/+$/, "") || "/";
  return collapsed;
}

export async function trackPageview(path: string): Promise<void> {
  const key = `pv:${dayKey()}:${normalizePath(path)}`;
  await redis.incr(key);
  await redis.expire(key, 60 * 60 * 24 * 90); // 90 days retention
}

export async function trackClick(event: string): Promise<void> {
  const key = `click:${event}:${dayKey()}`;
  await redis.incr(key);
  await redis.expire(key, 60 * 60 * 24 * 90);
}

export type DailyCount = { day: string; count: number };

export async function getPageviews(path: string, days = 7): Promise<DailyCount[]> {
  const normalized = normalizePath(path);
  const dayList = lastNDays(days);
  const keys = dayList.map((d) => `pv:${d}:${normalized}`);
  const values = await redis.mget<(number | null)[]>(...keys);
  return dayList.map((d, i) => ({ day: d, count: Number(values[i] ?? 0) }));
}

export async function getClicks(event: string, days = 7): Promise<DailyCount[]> {
  const dayList = lastNDays(days);
  const keys = dayList.map((d) => `click:${event}:${d}`);
  const values = await redis.mget<(number | null)[]>(...keys);
  return dayList.map((d, i) => ({ day: d, count: Number(values[i] ?? 0) }));
}

export function sum(daily: DailyCount[]): number {
  return daily.reduce((acc, x) => acc + x.count, 0);
}

// ---------------------------------------------------------------------------
// Per-visit pageview rows (Postgres) — drives the referrer + geo view in
// admin. Complements the Upstash daily counters above (which stay the fast
// path for the overview chart).
// ---------------------------------------------------------------------------

// Obvious crawlers we skip so the admin 'Recent visits' view doesn't fill
// up with noise. Not exhaustive — just the ones that identify themselves.
const BOT_UA_REGEX =
  /(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|facebookexternalhit|linkedinbot|twitterbot|applebot|semrushbot|ahrefsbot|mj12bot|petalbot|uptimerobot|monitoring|dataprovider|pingdom|headlesschrome|puppeteer|phantomjs|crawler|spider|scraper|bot\/)/i;

/**
 * Extract a clean hostname from a referrer URL. Returns null for empty or
 * for requests that came from our own origin (self-navigation isn't useful
 * for tracking external sources).
 */
export function parseReferrerDomain(referrer: string | null | undefined, ownHost?: string | null): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!host) return null;
    if (ownHost && host === ownHost.replace(/^www\./, "").toLowerCase()) return null;
    return host;
  } catch {
    return null;
  }
}

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true; // empty UA is overwhelmingly bots/curl
  return BOT_UA_REGEX.test(ua);
}

export async function recordVisit(params: {
  path: string;
  referrerDomain: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  userAgent: string | null;
}): Promise<void> {
  const uaTrimmed = params.userAgent ? params.userAgent.slice(0, 200) : null;
  await pg`
    INSERT INTO pageview_events
      (path, referrer_domain, country, region, city, user_agent)
    VALUES
      (${params.path}, ${params.referrerDomain},
       ${params.country}, ${params.region}, ${params.city}, ${uaTrimmed})
  `;
}

export type PageviewEventRow = {
  id: number;
  created_at: string;
  path: string;
  referrer_domain: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  user_agent: string | null;
};

export async function getRecentVisits(limit = 200): Promise<PageviewEventRow[]> {
  const safeLimit = Math.min(Math.max(1, limit | 0), 500);
  return (await pg`
    SELECT id, created_at, path, referrer_domain, country, region, city, user_agent
    FROM pageview_events
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `) as PageviewEventRow[];
}

export type DomainCount = { referrer_domain: string | null; visits: number };
export async function getTopReferrerDomains(days = 30): Promise<DomainCount[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return (await pg`
    SELECT referrer_domain, COUNT(*)::int AS visits
    FROM pageview_events
    WHERE created_at >= ${since.toISOString()}
    GROUP BY referrer_domain
    ORDER BY visits DESC
    LIMIT 50
  `) as DomainCount[];
}

export type CountryCount = { country: string | null; visits: number };
export async function getTopCountries(days = 30): Promise<CountryCount[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return (await pg`
    SELECT country, COUNT(*)::int AS visits
    FROM pageview_events
    WHERE created_at >= ${since.toISOString()}
    GROUP BY country
    ORDER BY visits DESC
    LIMIT 25
  `) as CountryCount[];
}
