import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { parseCsv } from "@/lib/csv-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "no file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const report = parseCsv(text);

  let inserted = 0;
  let updated = 0;
  const flagged: string[] = [];

  for (const r of report.parsedRows) {
    const result = await sql`
      INSERT INTO alumni (
        submitted_at, first_name, last_name, email, mobile, origin,
        uwc_college, uwc_college_raw, grad_year, grad_year_raw,
        current_city, region, help_tags, national_committee, about, questions,
        studying, working, flags, imported_at, updated_at
      ) VALUES (
        ${r.submitted_at}, ${r.first_name}, ${r.last_name}, ${r.email},
        ${r.mobile}, ${r.origin}, ${r.uwc_college}, ${r.uwc_college_raw},
        ${r.grad_year}, ${r.grad_year_raw}, ${r.current_city}, ${r.region},
        ${r.help_tags}, ${r.national_committee}, ${r.about}, ${r.questions},
        ${r.studying}, ${r.working}, ${r.flags}, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        submitted_at       = EXCLUDED.submitted_at,
        first_name         = EXCLUDED.first_name,
        last_name          = EXCLUDED.last_name,
        mobile             = EXCLUDED.mobile,
        origin             = EXCLUDED.origin,
        uwc_college        = EXCLUDED.uwc_college,
        uwc_college_raw    = EXCLUDED.uwc_college_raw,
        grad_year          = EXCLUDED.grad_year,
        grad_year_raw      = EXCLUDED.grad_year_raw,
        current_city       = EXCLUDED.current_city,
        region             = EXCLUDED.region,
        help_tags          = EXCLUDED.help_tags,
        national_committee = EXCLUDED.national_committee,
        about              = EXCLUDED.about,
        questions          = EXCLUDED.questions,
        studying           = EXCLUDED.studying,
        working            = EXCLUDED.working,
        flags              = EXCLUDED.flags,
        updated_at         = NOW()
      RETURNING (xmax = 0) AS inserted
    `;
    const wasInserted = (result[0] as { inserted: boolean }).inserted;
    if (wasInserted) inserted++;
    else updated++;
    if (r.flags.length > 0) flagged.push(r.email);
  }

  return NextResponse.json({
    total: report.total,
    rowsWithEmail: report.rowsWithEmail,
    inserted,
    updated,
    skipped: report.skipped.length,
    flagged: flagged.length,
    flaggedEmails: flagged.slice(0, 20),
  });
}
