import { NextResponse, type NextRequest } from "next/server";
import { runPreflight } from "@/lib/newsletter-ai/preflight";
import type { CampaignDraft } from "@/lib/campaign-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/newsletter-ai/preflight
 *  Body: { draft: CampaignDraft }
 *  Returns: PreflightResult from lib/newsletter-ai/preflight.
 *  Called by the compose page's "Preflight" button AND by the AI
 *  co-pilot's run_preflight_checks tool. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    draft?: CampaignDraft;
    recipientCount?: number;
  } | null;
  if (!body?.draft) {
    return NextResponse.json({ error: "draft required" }, { status: 400 });
  }
  const result = await runPreflight(body.draft, {
    recipientCount: body.recipientCount,
  });
  return NextResponse.json(result);
}
