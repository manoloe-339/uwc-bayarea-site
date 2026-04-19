import { Redis } from "@upstash/redis";

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
