import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { triggerEnrichment } from "@/lib/enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Admin approves a candidate (from the review queue) — sets the
 * approved LinkedIn URL on the alumni row and re-runs enrichment so
 * the actual scrape happens with the now-confirmed URL.
 *
 *   POST /api/enrichment/approve { alumni_id, linkedin_url }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    alumni_id?: number;
    linkedin_url?: string;
  };
  const alumniId = Number(body.alumni_id);
  const url = (body.linkedin_url ?? "").trim();
  if (!Number.isFinite(alumniId)) {
    return NextResponse.json({ error: "alumni_id required" }, { status: 400 });
  }
  if (!url || !/^https?:\/\/[^/]*linkedin\.com\//i.test(url)) {
    return NextResponse.json({ error: "valid linkedin_url required" }, { status: 400 });
  }

  const rows = (await sql`
    UPDATE alumni
    SET linkedin_url = ${url}, updated_at = NOW()
    WHERE id = ${alumniId}
    RETURNING id, first_name, last_name, email, uwc_college, grad_year, current_company
  `) as {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    uwc_college: string | null;
    grad_year: number | null;
    current_company: string | null;
  }[];
  const alum = rows[0];
  if (!alum) return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
  if (!alum.first_name || !alum.last_name) {
    return NextResponse.json({ error: "Alumni missing name" }, { status: 400 });
  }

  await sql`
    UPDATE alumni SET
      linkedin_enrichment_status = 'pending',
      linkedin_enrichment_error  = NULL,
      updated_at                 = NOW()
    WHERE id = ${alum.id}
  `;
  // Snapshot for closure type narrowing.
  const firstName = alum.first_name;
  const lastName = alum.last_name;
  after(async () => {
    try {
      await triggerEnrichment(alum.id, {
        linkedin_url: url,
        first_name: firstName,
        last_name: lastName,
        email: alum.email,
        uwc_college: alum.uwc_college,
        grad_year: alum.grad_year,
        company: alum.current_company,
      });
    } catch (err) {
      console.error(`[enrichment approve] background failed for ${alum.id}:`, err);
    }
  });
  return NextResponse.json({ success: true, alumni_id: alum.id, linkedin_url: url });
}
