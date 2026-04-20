import { NextResponse, type NextRequest } from "next/server";
import { geolocation } from "@vercel/functions";
import {
  trackPageview,
  recordVisit,
  parseReferrerDomain,
  isBotUserAgent,
} from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body.path === "string" && body.path.length < 200 ? body.path : "/";
    const clientReferrer =
      typeof body.referrer === "string" && body.referrer.length < 500 ? body.referrer : null;

    // Fast-path daily counter (Upstash) — always on.
    await trackPageview(path);

    // Per-visit row (Postgres) — skipped for known bots so the Recent Visits
    // view doesn't drown in crawler noise.
    const userAgent = req.headers.get("user-agent");
    if (!isBotUserAgent(userAgent)) {
      const ownHost = req.headers.get("host");
      const referrerDomain = parseReferrerDomain(clientReferrer, ownHost);
      const geo = geolocation(req);
      await recordVisit({
        path,
        referrerDomain,
        country: geo.country ?? null,
        region: geo.countryRegion ?? null,
        city: geo.city ? decodeURIComponent(geo.city) : null,
        userAgent,
      });
    }
  } catch {
    // swallow — analytics must never break the site
  }
  return NextResponse.json({ ok: true });
}
