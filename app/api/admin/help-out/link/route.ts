import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { setVolunteerSignupAlumni } from "@/lib/volunteer-signups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manual link: attach (or clear) a volunteer signup's alumni_id.
 * POST /api/admin/help-out/link?id=NN&alumni_id=NN (or empty to clear). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const alumniIdRaw = url.searchParams.get("alumni_id") ?? "";
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const alumniId = alumniIdRaw === "" ? null : Number(alumniIdRaw);
  if (alumniId !== null && (!Number.isFinite(alumniId) || alumniId <= 0)) {
    return NextResponse.json({ error: "Invalid alumni_id" }, { status: 400 });
  }
  await setVolunteerSignupAlumni(id, alumniId);
  revalidatePath("/admin/help-out");
  return NextResponse.json({ ok: true });
}
