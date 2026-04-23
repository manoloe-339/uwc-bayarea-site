import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { generateQRToken } from "@/lib/qr-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the QR token for an attendee — generating one on the fly if
 * missing (same behavior as the "Send QR code" action). Used by the
 * admin "View QR code" modal so the admin can inspect / download
 * without triggering an email send.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const rows = (await sql`
    SELECT id, event_id, qr_code_data, deleted_at
    FROM event_attendees
    WHERE id = ${id}
    LIMIT 1
  `) as {
    id: number;
    event_id: number;
    qr_code_data: string | null;
    deleted_at: Date | null;
  }[];
  const r = rows[0];
  if (!r) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  if (r.deleted_at) {
    return NextResponse.json({ error: "Attendee was removed" }, { status: 400 });
  }
  if (r.qr_code_data) {
    return NextResponse.json({ token: r.qr_code_data, generated: false });
  }
  try {
    const token = generateQRToken(r.id, r.event_id);
    await sql`
      UPDATE event_attendees SET qr_code_data = ${token}, updated_at = NOW()
      WHERE id = ${r.id}
    `;
    return NextResponse.json({ token, generated: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate" },
      { status: 500 }
    );
  }
}
