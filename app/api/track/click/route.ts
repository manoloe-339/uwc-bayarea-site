import { NextResponse, type NextRequest } from "next/server";
import { trackClick } from "@/lib/analytics";

const ALLOWED = new Set(["ticket", "signup"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const event = typeof body.event === "string" ? body.event : "";
    if (ALLOWED.has(event)) {
      await trackClick(event);
    }
  } catch {
    // swallow
  }
  return NextResponse.json({ ok: true });
}
