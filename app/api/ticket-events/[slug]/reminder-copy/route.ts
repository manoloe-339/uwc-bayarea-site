import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getEventBySlug } from "@/lib/events-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  subject?: string | null;
  heading?: string | null;
  body?: string | null;
};

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const input = (await req.json().catch(() => ({}))) as Body;
  const subject = clean(input.subject);
  const heading = clean(input.heading);
  const body = clean(input.body);

  await sql`
    UPDATE events
    SET reminder_subject = ${subject},
        reminder_heading = ${heading},
        reminder_body = ${body},
        updated_at = NOW()
    WHERE id = ${event.id}
  `;
  revalidatePath(`/admin/events/${slug}/communications`);
  return NextResponse.json({ ok: true });
}
