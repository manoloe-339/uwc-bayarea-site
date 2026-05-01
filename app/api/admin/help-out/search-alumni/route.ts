import { NextResponse, type NextRequest } from "next/server";
import { searchAlumniForVolunteerLink } from "@/lib/volunteer-signups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight alumni search used by the manual-link UI on
 * /admin/help-out. Returns up to 10 candidates by name or email match. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const results = await searchAlumniForVolunteerLink(q);
  return NextResponse.json({ results });
}
