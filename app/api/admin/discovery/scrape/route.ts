import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { scrapeLinkedinProfile } from "@/lib/enrichment/linkedin-scraper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { id?: number } | null;
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const rows = (await sql`
    SELECT id, linkedin_url FROM alumni_candidates WHERE id = ${id}
  `) as { id: number; linkedin_url: string }[];
  const candidate = rows[0];
  if (!candidate) {
    return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  }

  const result = await scrapeLinkedinProfile(candidate.linkedin_url);
  if (!result.ok) {
    return NextResponse.json(
      { error: `Scrape failed: ${result.reason}`, detail: result },
      { status: 502 }
    );
  }

  await sql`
    UPDATE alumni_candidates
    SET scraped_data = ${JSON.stringify(result.profile)}::jsonb,
        status = 'scraped',
        reviewed_at = NOW()
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true, profile: result.profile });
}
