import { NextResponse } from "next/server";
import { getSiteSettings, DEFAULT_LINKEDIN_INVITE_TEMPLATE } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const s = await getSiteSettings();
  const template = s.linkedin_invite_template?.trim() || DEFAULT_LINKEDIN_INVITE_TEMPLATE;
  return NextResponse.json(
    { template },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
