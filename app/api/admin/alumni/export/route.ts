import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { searchAlumni, type AlumniFilters } from "@/lib/alumni-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numParam(sp: URLSearchParams, key: string): number | undefined {
  const v = sp.get(key);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filters: AlumniFilters = {
    q: sp.get("q") ?? undefined,
    college: sp.get("college") ?? undefined,
    region: sp.get("region") ?? undefined,
    origin: sp.get("origin") ?? undefined,
    city: sp.get("city") ?? undefined,
    yearFrom: numParam(sp, "yearFrom"),
    yearTo: numParam(sp, "yearTo"),
    help: sp.get("help") ?? undefined,
    includeNonAlums: sp.get("includeNonAlums") === "1",
    includeMovedOut: sp.get("includeMovedOut") === "1",
  };

  const rows = await searchAlumni(filters, 10_000);
  const csv = Papa.unparse(
    rows.map((r) => ({
      first_name: r.first_name,
      last_name: r.last_name,
      uwc_college: r.uwc_college,
      grad_year: r.grad_year,
      origin: r.origin,
      current_city: r.current_city,
      region: r.region,
      affiliation: r.affiliation,
      company: r.company,
      email: r.email,
      mobile: r.mobile,
      help_tags: r.help_tags,
      national_committee: r.national_committee,
      studying: r.studying,
      working: r.working,
      about: r.about,
      questions: r.questions,
    }))
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uwc-alumni-${stamp}.csv"`,
    },
  });
}
