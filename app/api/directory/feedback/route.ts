import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { DIRECTORY_COOKIE, hashSessionForAudit } from "@/lib/directory-auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/** Read-only-user feedback intake. Topic + free-text message + optional
 * contact name. Topic 'profile' includes an alumni_id so the admin
 * tool can link back to the relevant record. */
export async function POST(req: Request): Promise<NextResponse> {
  let body: {
    topic?: string;
    alumni_id?: number | null;
    message?: string;
    contact_name?: string | null;
    page_url?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const topicRaw = String(body.topic ?? "general").toLowerCase();
  const topic = ["general", "profile", "bug"].includes(topicRaw)
    ? topicRaw
    : "general";
  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  const alumni_id =
    typeof body.alumni_id === "number" && Number.isFinite(body.alumni_id)
      ? body.alumni_id
      : null;
  const contact_name = body.contact_name?.trim() || null;
  const page_url = body.page_url?.toString().slice(0, 500) ?? null;

  // Hash the session cookie for audit correlation without storing the
  // cookie itself.
  const c = await cookies();
  const cookieValue = c.get(DIRECTORY_COOKIE)?.value ?? "";
  const session_id = cookieValue ? await hashSessionForAudit(cookieValue) : "";

  await sql`
    INSERT INTO directory_feedback (
      session_id, topic, alumni_id, message, contact_name, page_url
    ) VALUES (
      ${session_id}, ${topic}, ${alumni_id}, ${message}, ${contact_name}, ${page_url}
    )
  `;

  return NextResponse.json({ ok: true });
}
