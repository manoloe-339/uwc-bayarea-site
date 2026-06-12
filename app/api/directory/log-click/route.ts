import { NextResponse, type NextRequest } from "next/server";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import { logDirectoryLinkedinClick } from "@/lib/directory-query";
import { readGeoFields } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fire-and-forget endpoint hit by the LinkedIn icon on directory
 * cards / profile / saved rows. Body: { alumni_id }. We log who
 * tried to connect with whom so admins can see the most valuable
 * outbound action (clicking through to LinkedIn) — stronger intent
 * than a passive profile_view.
 *
 * Client should use navigator.sendBeacon so the request survives
 * the navigation to LinkedIn.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getCurrentDirectorySession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { alumni_id?: number };
  try {
    body = (await req.json()) as { alumni_id?: number };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const id = Number(body.alumni_id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const userId = session.kind === "user" ? session.user.id : null;
  await logDirectoryLinkedinClick(
    session.auditSessionId,
    id,
    userId,
    readGeoFields(req.headers),
  );
  return NextResponse.json({ ok: true });
}
