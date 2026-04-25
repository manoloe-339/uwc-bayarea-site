import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin rejects a candidate (review queue) — marks the row as failed
 * with an explicit "admin rejected" reason so it's distinguishable in
 * stats/queries from genuine API failures.
 *
 * Does NOT touch linkedin_url — leave whatever the alum self-supplied
 * intact in case admin wants to reconsider later.
 *
 *   POST /api/enrichment/reject { alumni_id }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { alumni_id?: number };
  const alumniId = Number(body.alumni_id);
  if (!Number.isFinite(alumniId)) {
    return NextResponse.json({ error: "alumni_id required" }, { status: 400 });
  }
  const rows = (await sql`
    UPDATE alumni
    SET linkedin_enrichment_status = 'failed',
        linkedin_enrichment_error  = 'No LinkedIn profile found (admin rejected)',
        linkedin_enriched_at       = NOW(),
        updated_at                 = NOW()
    WHERE id = ${alumniId}
    RETURNING id
  `) as { id: number }[];
  if (!rows[0]) return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
  return NextResponse.json({ success: true, alumni_id: rows[0].id });
}
