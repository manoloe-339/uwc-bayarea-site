import { NextResponse } from "next/server";
import { separateArchiveIntoEvents } from "@/lib/event-photos/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(): Promise<NextResponse> {
  const result = await separateArchiveIntoEvents();
  return NextResponse.json({ ok: true, ...result });
}
