import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = ["standard", "first-emphasis"] as const;
type Layout = (typeof VALID)[number];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    eventId?: number;
    layout?: string;
  } | null;

  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }
  if (!body?.layout || !(VALID as readonly string[]).includes(body.layout)) {
    return NextResponse.json(
      { error: "layout must be 'standard' or 'first-emphasis'" },
      { status: 400 }
    );
  }
  const layout = body.layout as Layout;
  await sql`UPDATE events SET name_tag_layout = ${layout} WHERE id = ${eventId}`;
  return NextResponse.json({ ok: true });
}
