import { NextResponse, type NextRequest } from "next/server";
import { createStandaloneNameTag } from "@/lib/event-name-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    eventId?: number;
    first_name?: string;
    last_name?: string;
    uwc_college?: string | null;
    grad_year?: number | null;
    line_3?: string | null;
    line_4?: string | null;
    notes?: string | null;
  } | null;

  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const tag = await createStandaloneNameTag(eventId, {
    first_name: (body?.first_name ?? "").trim(),
    last_name: (body?.last_name ?? "").trim(),
    uwc_college: body?.uwc_college?.trim() || null,
    grad_year: body?.grad_year ?? null,
    line_3: body?.line_3?.trim() || null,
    line_4: body?.line_4?.trim() || null,
    notes: body?.notes?.trim() || null,
  });
  return NextResponse.json({ ok: true, tag });
}
