import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Used by the homepage news-feature admin form when the alum you want
 * to feature isn't already in the database. Creates a minimal alumni
 * row tagged `admin_added` (so community counts ignore them) with
 * everything except first_name and last_name optional. Email is
 * intentionally not collected — these aren't community members and
 * shouldn't receive campaign emails. */
interface CreatePayload {
  first_name?: string;
  last_name?: string;
  uwc_college?: string;
  grad_year?: number | string;
  photo_url?: string;
  linkedin_url?: string;
  current_title?: string;
  current_company?: string;
}

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function parseYear(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  if (n < 1950 || n > 2100) return null;
  return Math.trunc(n);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CreatePayload;
  try {
    body = (await req.json()) as CreatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const first_name = clean(body.first_name);
  const last_name = clean(body.last_name);
  if (!first_name || !last_name) {
    return NextResponse.json(
      { error: "first_name and last_name are required" },
      { status: 400 },
    );
  }

  const uwc_college = clean(body.uwc_college);
  const grad_year = parseYear(body.grad_year);
  const photo_url = clean(body.photo_url);
  const linkedin_url = clean(body.linkedin_url);
  const current_title = clean(body.current_title);
  const current_company = clean(body.current_company);

  const rows = (await sql`
    INSERT INTO alumni (
      first_name, last_name, uwc_college, grad_year,
      photo_url, linkedin_url, current_title, current_company,
      sources
    )
    VALUES (
      ${first_name}, ${last_name}, ${uwc_college}, ${grad_year},
      ${photo_url}, ${linkedin_url}, ${current_title}, ${current_company},
      ARRAY['admin_added']::TEXT[]
    )
    RETURNING id, first_name, last_name, email, uwc_college, grad_year
  `) as {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    uwc_college: string | null;
    grad_year: number | null;
  }[];

  return NextResponse.json({ alumnus: rows[0] });
}
