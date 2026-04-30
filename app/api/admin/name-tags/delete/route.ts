import { NextResponse, type NextRequest } from "next/server";
import { deleteNameTag } from "@/lib/event-name-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { id?: number } | null;
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await deleteNameTag(id);
  return NextResponse.json({ ok: true });
}
