import { NextResponse } from "next/server";
import { runAndLogDiscoveryBatch } from "@/lib/discovery/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(): Promise<NextResponse> {
  try {
    const result = await runAndLogDiscoveryBatch();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "discovery failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
