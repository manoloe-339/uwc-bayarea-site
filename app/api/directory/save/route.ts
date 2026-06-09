import { NextResponse } from "next/server";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import {
  deleteSave,
  isSaveReason,
  isSaveStatus,
  MAX_NOTE_CHARS,
  upsertSave,
} from "@/lib/directory-saves";

export const runtime = "nodejs";

/** Save / update a saved row. Body: { alumni_id, status?, reason?, note? }.
 * Idempotent — repeated calls update the existing row. Only callable by
 * per-user sessions (shared sessions can't save: no identity). */
export async function POST(req: Request): Promise<NextResponse> {
  const session = await getCurrentDirectorySession();
  if (!session || session.kind !== "user") {
    return NextResponse.json(
      { error: "Sign in with a personal account to save." },
      { status: 401 },
    );
  }

  let body: {
    alumni_id?: unknown;
    status?: unknown;
    reason?: unknown;
    note?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const alumniId = Number(body.alumni_id);
  if (!Number.isFinite(alumniId) || alumniId <= 0) {
    return NextResponse.json({ error: "Invalid alumni_id" }, { status: 400 });
  }

  let parsedStatus: ReturnType<typeof String> | undefined;
  if (typeof body.status === "string" && body.status) {
    if (isSaveStatus(body.status)) parsedStatus = body.status;
    else return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  let parsedReason: string | null | undefined;
  if (typeof body.reason === "string" && body.reason) {
    if (isSaveReason(body.reason)) parsedReason = body.reason;
    else return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  } else if (body.reason === null) {
    parsedReason = null;
  }

  let parsedNote: string | null = null;
  if (typeof body.note === "string") {
    parsedNote = body.note.slice(0, MAX_NOTE_CHARS);
  }

  const row = await upsertSave({
    directoryUserId: session.user.id,
    alumniId,
    status: parsedStatus as never,
    reason: parsedReason as never,
    note: parsedNote,
  });

  return NextResponse.json({
    ok: true,
    save: {
      id: row.id,
      status: row.status,
      reason: row.reason,
      note: row.note,
      updated_at: row.updated_at,
    },
  });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const session = await getCurrentDirectorySession();
  if (!session || session.kind !== "user") {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const alumniId = Number(url.searchParams.get("alumni_id"));
  if (!Number.isFinite(alumniId) || alumniId <= 0) {
    return NextResponse.json({ error: "Invalid alumni_id" }, { status: 400 });
  }
  await deleteSave(session.user.id, alumniId);
  return NextResponse.json({ ok: true });
}
