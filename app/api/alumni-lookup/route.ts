import { NextResponse, type NextRequest } from "next/server";
import { lookupAlumniForHelpOut } from "@/lib/volunteer-signups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight name+email lookup used by the public Help Out form.
 * Returns whether the submitter is in the alumni directory and (when
 * matched) their basic display info. Never returns email addresses or
 * other PII back to the form. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";
  const email = url.searchParams.get("email") ?? "";
  const result = await lookupAlumniForHelpOut({ name, email });
  return NextResponse.json(result);
}
