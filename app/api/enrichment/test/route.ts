import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { triggerEnrichment } from "@/lib/enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manual enrichment trigger for development + QA.
 *
 *   curl -X POST http://localhost:3000/api/enrichment/test \
 *     -H "Content-Type: application/json" \
 *     -d '{"alumni_id": 123}'
 *
 * Kicks off the job and returns immediately. Poll the alumni row a
 * minute later to see linkedin_enrichment_status flip to 'complete'.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { alumni_id?: number };
  const alumniId = Number(body.alumni_id);
  if (!Number.isFinite(alumniId)) {
    return NextResponse.json({ error: "alumni_id required" }, { status: 400 });
  }

  const rows = (await sql`
    SELECT id, first_name, last_name, email, linkedin_url,
           uwc_college, grad_year, current_company
    FROM alumni WHERE id = ${alumniId} LIMIT 1
  `) as {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    linkedin_url: string | null;
    uwc_college: string | null;
    grad_year: number | null;
    current_company: string | null;
  }[];

  const alum = rows[0];
  if (!alum) {
    return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
  }
  if (!alum.first_name || !alum.last_name) {
    return NextResponse.json(
      { error: "Alumni must have first_name and last_name set" },
      { status: 400 }
    );
  }

  await triggerEnrichment(alum.id, {
    linkedin_url: alum.linkedin_url,
    first_name: alum.first_name,
    last_name: alum.last_name,
    email: alum.email,
    uwc_college: alum.uwc_college,
    grad_year: alum.grad_year,
    company: alum.current_company,
  });

  return NextResponse.json({
    success: true,
    message:
      "Enrichment queued. linkedin_enrichment_status will flip to 'complete' / 'needs_review' / 'failed' within ~60s.",
    alumni_id: alum.id,
  });
}
