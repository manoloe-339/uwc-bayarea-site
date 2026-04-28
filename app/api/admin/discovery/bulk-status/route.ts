import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "confirmed",
  "rejected",
  "invited_linkedin",
  "already_connected",
] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    ids?: number[];
    status?: string;
    notes?: string;
  } | null;

  const ids = Array.isArray(body?.ids)
    ? body!.ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(body?.status as ValidStatus)) {
    return NextResponse.json(
      { error: `status must be one of ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }
  const status = body!.status as ValidStatus;

  const rows = (await sql`
    UPDATE alumni_candidates
    SET status = ${status},
        notes = COALESCE(${body?.notes ?? null}, notes),
        reviewed_at = NOW()
    WHERE id = ANY(${ids})
    RETURNING id
  `) as { id: number }[];

  return NextResponse.json({ ok: true, count: rows.length });
}
