import { NextResponse } from "next/server";
import { runDiscoveryBatch, triageAndStore } from "@/lib/discovery/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(): Promise<NextResponse> {
  try {
    const hits = await runDiscoveryBatch();
    const outcome = await triageAndStore(hits);
    return NextResponse.json({
      ok: true,
      total_hits: hits.length,
      ...outcome,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "discovery failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
