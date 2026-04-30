import { NextResponse, type NextRequest } from "next/server";
import { setNameTagStatus, type NameTagStatus } from "@/lib/event-name-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: NameTagStatus[] = ["pending", "fix", "finalized"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    id?: number;
    status?: string;
  } | null;

  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (!body?.status || !VALID.includes(body.status as NameTagStatus)) {
    return NextResponse.json({ error: "status must be pending|fix|finalized" }, { status: 400 });
  }
  const tag = await setNameTagStatus(id, body.status as NameTagStatus);
  if (!tag) return NextResponse.json({ error: "Name tag not found" }, { status: 404 });
  return NextResponse.json({ ok: true, tag });
}
