import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { triggerEnrichment } from "@/lib/enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Pending rows older than this are considered stale and may be overwritten. */
const STALE_PENDING_AGE_MIN = 10;

/**
 * Manually start enrichment on an alumni row. Replaces the previous
 * /api/enrichment/test ad-hoc endpoint — same shape, just gated.
 *
 *   POST /api/enrichment/trigger { alumni_id }
 *
 * Rejects 409 if the row is currently pending and the pending row was
 * marked within the last STALE_PENDING_AGE_MIN minutes (avoid kicking
 * off a duplicate Apify run while one is genuinely in flight). Older
 * pending rows are treated as stuck and overwritten.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { alumni_id?: number };
  const alumniId = Number(body.alumni_id);
  if (!Number.isFinite(alumniId)) {
    return NextResponse.json({ error: "alumni_id required" }, { status: 400 });
  }

  const rows = (await sql`
    SELECT id, first_name, last_name, email, linkedin_url,
           uwc_college, grad_year, current_company,
           linkedin_enrichment_status,
           EXTRACT(EPOCH FROM (NOW() - updated_at))::int AS pending_age_seconds
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
    linkedin_enrichment_status: string | null;
    pending_age_seconds: number;
  }[];
  const alum = rows[0];
  if (!alum) {
    return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
  }
  if (!alum.first_name || !alum.last_name) {
    return NextResponse.json(
      { error: "Alumni must have first_name and last_name to enrich" },
      { status: 400 }
    );
  }
  if (
    alum.linkedin_enrichment_status === "pending" &&
    alum.pending_age_seconds < STALE_PENDING_AGE_MIN * 60
  ) {
    return NextResponse.json(
      {
        error: "already_pending",
        message: "Enrichment already in progress",
        pending_for_seconds: alum.pending_age_seconds,
      },
      { status: 409 }
    );
  }

  // Stamp pending immediately so the badge flips before the response
  // returns; the actual scrape/search runs after() in the background so
  // the admin gets an instant confirmation.
  await sql`
    UPDATE alumni SET
      linkedin_enrichment_status = 'pending',
      linkedin_enrichment_error  = NULL,
      updated_at                 = NOW()
    WHERE id = ${alum.id}
  `;
  // Snapshot non-null name fields so the closure below has narrow types.
  const firstName = alum.first_name;
  const lastName = alum.last_name;
  after(async () => {
    try {
      await triggerEnrichment(alum.id, {
        linkedin_url: alum.linkedin_url,
        first_name: firstName,
        last_name: lastName,
        email: alum.email,
        uwc_college: alum.uwc_college,
        grad_year: alum.grad_year,
        company: alum.current_company,
      });
    } catch (err) {
      console.error(`[enrichment trigger] background failed for ${alum.id}:`, err);
    }
  });
  return NextResponse.json({
    success: true,
    message: "Enrichment queued — terminal state reached in ~30–90s.",
    alumni_id: alum.id,
  });
}
