import { NextResponse, type NextRequest } from "next/server";
import { trackPageview } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body.path === "string" && body.path.length < 200 ? body.path : "/";
    await trackPageview(path);
  } catch {
    // swallow — analytics must never break the site
  }
  return NextResponse.json({ ok: true });
}
