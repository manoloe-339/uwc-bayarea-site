import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddBody = {
  candidate_id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  uwc_college?: string | null;
  grad_year?: number | null;
  origin?: string | null;
  current_company?: string | null;
  current_title?: string | null;
  location_city?: string | null;
  location_country?: string | null;
};

type CandidateRow = {
  id: number;
  linkedin_url: string;
  name_guess: string | null;
  scraped_data: unknown;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as AddBody | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const candidateId = Number(body.candidate_id);
  const email = body.email?.trim().toLowerCase();
  if (!Number.isFinite(candidateId) || candidateId <= 0) {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const candidates = (await sql`
    SELECT id, linkedin_url, name_guess, scraped_data
    FROM alumni_candidates WHERE id = ${candidateId}
  `) as CandidateRow[];
  const candidate = candidates[0];
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });

  // Check email isn't already in alumni.
  const existing = (await sql`
    SELECT id FROM alumni WHERE LOWER(email) = ${email} LIMIT 1
  `) as { id: number }[];
  if (existing[0]) {
    return NextResponse.json(
      { error: `An alumni record with this email already exists (id ${existing[0].id})` },
      { status: 409 }
    );
  }

  // Pull defaults from scraped_data if available; admin's overrides win.
  const sd = (candidate.scraped_data ?? {}) as Record<string, unknown>;
  const firstName =
    body.first_name?.trim() ||
    (typeof sd.firstName === "string" ? sd.firstName : null) ||
    candidate.name_guess?.split(" ")[0] ||
    null;
  const lastName =
    body.last_name?.trim() ||
    (typeof sd.lastName === "string" ? sd.lastName : null) ||
    candidate.name_guess?.split(" ").slice(1).join(" ") ||
    null;
  const headline = typeof sd.headline === "string" ? sd.headline : null;
  const company =
    body.current_company?.trim() ||
    (typeof sd.companyName === "string" ? sd.companyName : null) ||
    null;
  const title =
    body.current_title?.trim() ||
    (typeof sd.jobTitle === "string" ? sd.jobTitle : null) ||
    null;
  const locationCity = body.location_city?.trim() || null;
  const locationCountry = body.location_country?.trim() || null;
  const photo =
    (typeof sd.profilePicHighQuality === "string" ? sd.profilePicHighQuality : null) ||
    (typeof sd.profilePic === "string" ? sd.profilePic : null);

  const ins = (await sql`
    INSERT INTO alumni (
      first_name, last_name, email,
      uwc_college, grad_year, origin,
      linkedin_url, headline,
      current_company, current_title,
      location_city, location_country,
      photo_url,
      linkedin_enrichment_status, linkedin_enriched_at, linkedin_raw_data
    ) VALUES (
      ${firstName}, ${lastName}, ${email},
      ${body.uwc_college ?? null}, ${body.grad_year ?? null}, ${body.origin ?? null},
      ${candidate.linkedin_url}, ${headline},
      ${company}, ${title},
      ${locationCity}, ${locationCountry},
      ${photo},
      ${candidate.scraped_data ? "complete" : "pending"},
      ${candidate.scraped_data ? new Date().toISOString() : null},
      ${candidate.scraped_data ? JSON.stringify(candidate.scraped_data) : null}::jsonb
    )
    RETURNING id
  `) as { id: number }[];

  const newAlumniId = ins[0].id;

  await sql`
    UPDATE alumni_candidates
    SET status = 'added', matched_alumni_id = ${newAlumniId}, reviewed_at = NOW()
    WHERE id = ${candidateId}
  `;

  return NextResponse.json({ ok: true, alumni_id: newAlumniId });
}
