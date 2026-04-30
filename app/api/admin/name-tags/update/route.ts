import { NextResponse, type NextRequest } from "next/server";
import { updateNameTag } from "@/lib/event-name-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nullableTrim(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    id?: number;
    first_name?: string;
    last_name?: string;
    uwc_college?: string | null;
    grad_year?: number | null;
    line_3?: string | null;
    line_4?: string | null;
    notes?: string | null;
  } | null;

  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let gradYear: number | null | undefined;
  if (body?.grad_year === undefined) {
    gradYear = undefined;
  } else if (body.grad_year === null) {
    gradYear = null;
  } else {
    const n = Number(body.grad_year);
    if (!Number.isFinite(n) || n < 1960 || n > 2100) {
      return NextResponse.json({ error: "grad_year must be 1960-2100 or null" }, { status: 400 });
    }
    gradYear = Math.trunc(n);
  }

  const updated = await updateNameTag(id, {
    first_name: body?.first_name !== undefined ? String(body.first_name).trim() : undefined,
    last_name: body?.last_name !== undefined ? String(body.last_name).trim() : undefined,
    uwc_college: nullableTrim(body?.uwc_college),
    grad_year: gradYear,
    line_3: nullableTrim(body?.line_3),
    line_4: nullableTrim(body?.line_4),
    notes: nullableTrim(body?.notes),
  });

  if (!updated) {
    return NextResponse.json({ error: "Name tag not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, tag: updated });
}
