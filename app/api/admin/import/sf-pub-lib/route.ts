import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { parseSfPubLibCsv } from "@/lib/sf-pub-lib-import";
import { cityToRegion } from "@/lib/region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE = "sf_pub_lib";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "no file uploaded" }, { status: 400 });
  }
  const text = await file.text();
  const report = parseSfPubLibCsv(text);

  let inserted = 0;
  let updated = 0;
  const flagged: string[] = [];

  for (const r of report.parsed) {
    // Preserve existing richer data: only fill fields that are currently null.
    // For truly new rows, we have less data so we set what we have.
    const existing = (await sql`
      SELECT id, origin, region, affiliation, company, attended_event, sources,
             uwc_college, grad_year, first_name, last_name, current_city, flags
      FROM alumni WHERE email = ${r.email}
    `) as {
      id: number;
      origin: string | null;
      region: string | null;
      affiliation: string | null;
      company: string | null;
      attended_event: boolean | null;
      sources: string[] | null;
      uwc_college: string | null;
      grad_year: number | null;
      first_name: string | null;
      last_name: string | null;
      current_city: string | null;
      flags: string[] | null;
    }[];

    if (existing.length > 0) {
      const e = existing[0];
      const mergedSources = Array.from(new Set([...(e.sources ?? []), SOURCE]));
      const mergedFlags = Array.from(new Set([...(e.flags ?? []), ...r.flags]));
      // Only fill where currently null. Never overwrite.
      const nextOrigin = e.origin ?? r.origin;
      const nextAffiliation = e.affiliation ?? r.affiliation;
      const nextCompany = e.company ?? r.company;
      const nextAttended = e.attended_event || r.attended_event;
      const nextCollege = e.uwc_college ?? r.uwc_college;
      const nextGradYear = e.grad_year ?? r.grad_year;
      const nextRegion = e.region ?? cityToRegion(e.current_city);

      await sql`
        UPDATE alumni SET
          origin         = ${nextOrigin},
          region         = ${nextRegion},
          affiliation    = ${nextAffiliation},
          company        = ${nextCompany},
          attended_event = ${nextAttended},
          uwc_college    = ${nextCollege},
          grad_year      = ${nextGradYear},
          sources        = ${mergedSources},
          flags          = ${mergedFlags},
          updated_at     = NOW()
        WHERE id = ${e.id}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO alumni (
          first_name, last_name, email, affiliation,
          uwc_college, uwc_college_raw, grad_year, grad_year_raw,
          origin, region, company, attended_event,
          sources, flags, imported_at, updated_at
        ) VALUES (
          ${r.first_name}, ${r.last_name}, ${r.email}, ${r.affiliation},
          ${r.uwc_college}, ${r.uwc_college_raw}, ${r.grad_year}, ${r.grad_year_raw},
          ${r.origin}, ${r.region}, ${r.company}, ${r.attended_event},
          ${[SOURCE]}, ${r.flags}, NOW(), NOW()
        )
      `;
      inserted++;
    }
    if (r.flags.length > 0) flagged.push(r.email);
  }

  return NextResponse.json({
    total: report.total,
    parsed: report.parsed.length,
    inserted,
    updated,
    skipped: report.skipped.length,
    flagged: flagged.length,
    flaggedEmails: flagged.slice(0, 30),
  });
}
