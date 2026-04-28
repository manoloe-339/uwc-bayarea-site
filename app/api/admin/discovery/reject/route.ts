import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { id?: number; notes?: string } | null;
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const rows = (await sql`
    UPDATE alumni_candidates
    SET status = 'rejected', notes = ${body?.notes ?? null}, reviewed_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `) as { id: number }[];
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
