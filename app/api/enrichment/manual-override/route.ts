import { NextResponse, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  alumni_id: number;
  headline?: string | null;
  current_company?: string | null;
  current_title?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  about?: string | null;
  /** "data:image/...;base64,..." or an absolute http(s) URL — both supported. */
  photo?: string | null;
};

function clean(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t ? t : null;
}

/**
 * Admin types data for an alum manually (e.g. when LinkedIn is private
 * or the scraper API is down). status is set to 'complete' so the
 * record looks the same as a successful scrape in queries, but
 * linkedin_raw_data carries source='manual_override' for audit.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const alumniId = Number(body.alumni_id);
  if (!Number.isFinite(alumniId)) {
    return NextResponse.json({ error: "alumni_id required" }, { status: 400 });
  }

  let photoUrl: string | null = null;
  if (body.photo && typeof body.photo === "string") {
    try {
      if (body.photo.startsWith("data:")) {
        const m = body.photo.match(/^data:([^;]+);base64,(.+)$/);
        if (m) {
          const buf = Buffer.from(m[2], "base64");
          const ext = m[1].split("/")[1] ?? "jpg";
          const uploaded = await put(
            `alumni-photos/${alumniId}.${ext}`,
            buf,
            { access: "public", allowOverwrite: true }
          );
          photoUrl = uploaded.url;
        }
      } else if (/^https?:\/\//.test(body.photo)) {
        photoUrl = body.photo;
      }
    } catch (err) {
      console.error("[enrichment override] photo upload failed:", err);
    }
  }

  const audit = {
    source: "manual_override",
    entered_at: new Date().toISOString(),
    fields: {
      headline: clean(body.headline),
      current_company: clean(body.current_company),
      current_title: clean(body.current_title),
      location_city: clean(body.location_city),
      location_country: clean(body.location_country),
      about: clean(body.about),
      photo_url: photoUrl,
    },
  };

  const rows = (await sql`
    UPDATE alumni SET
      headline                   = COALESCE(${clean(body.headline)}, headline),
      current_company            = COALESCE(${clean(body.current_company)}, current_company),
      current_title              = COALESCE(${clean(body.current_title)}, current_title),
      location_city              = COALESCE(${clean(body.location_city)}, location_city),
      location_country           = COALESCE(${clean(body.location_country)}, location_country),
      about                      = COALESCE(${clean(body.about)}, about),
      photo_url                  = COALESCE(${photoUrl}, photo_url),
      linkedin_enrichment_status = 'complete',
      linkedin_enrichment_error  = NULL,
      linkedin_enriched_at       = NOW(),
      linkedin_raw_data          = ${JSON.stringify(audit)}::jsonb,
      updated_at                 = NOW()
    WHERE id = ${alumniId}
    RETURNING id
  `) as { id: number }[];
  if (!rows[0]) return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
  return NextResponse.json({ success: true, alumni_id: rows[0].id });
}
