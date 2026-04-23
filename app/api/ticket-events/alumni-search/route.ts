import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Typeahead for the special-guest modal and the match-review modal.
 * Limits to 10 hits, returns the compact shape those UIs need.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const like = `%${q}%`;
  const rows = (await sql`
    SELECT id, first_name, last_name, email, uwc_college, grad_year, photo_url
    FROM alumni
    WHERE deceased IS NOT TRUE
      AND (
        lower(first_name) LIKE ${like}
        OR lower(last_name) LIKE ${like}
        OR lower(first_name || ' ' || last_name) LIKE ${like}
        OR lower(email) LIKE ${like}
      )
    ORDER BY first_name, last_name
    LIMIT 10
  `) as {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    uwc_college: string | null;
    grad_year: number | null;
    photo_url: string | null;
  }[];
  return NextResponse.json({ results: rows });
}
