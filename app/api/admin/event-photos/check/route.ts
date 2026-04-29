import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies that an upload actually landed in the DB.
 * The Vercel Blob client treats an upload as "done" once the bytes are in
 * blob storage, but our onUploadCompleted webhook may still be running
 * (or may have failed silently — e.g., a corrupt HEIC that heic-convert
 * can't decode). The PhotoUploadZone polls this endpoint per file to
 * surface real success vs. server-side failure to the user.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const eventId = Number(url.searchParams.get("eventId"));
  const filename = url.searchParams.get("filename");
  const sinceParam = url.searchParams.get("since");

  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }
  if (!filename) {
    return NextResponse.json({ error: "filename required" }, { status: 400 });
  }

  const sinceMs = sinceParam ? Number(sinceParam) : NaN;
  const sinceDate = Number.isFinite(sinceMs)
    ? new Date(sinceMs)
    : new Date(Date.now() - 5 * 60 * 1000);

  const rows = (await sql`
    SELECT id FROM event_photos
    WHERE event_id = ${eventId}
      AND original_filename = ${filename}
      AND uploaded_at >= ${sinceDate}
    LIMIT 1
  `) as { id: number }[];

  return NextResponse.json({ exists: rows.length > 0 });
}
