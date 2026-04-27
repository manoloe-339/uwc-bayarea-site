import { NextResponse, type NextRequest } from "next/server";
import { getEventPhotos, getPhotosByIds } from "@/lib/event-photos/queries";
import { generatePhotoZip } from "@/lib/event-photos/zip-generator";
import { sql } from "@/lib/db";
import type { ApprovalStatus } from "@/lib/event-photos/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event";
}

async function eventSlug(eventId: number): Promise<string> {
  const rows = (await sql`SELECT slug, name FROM events WHERE id = ${eventId} LIMIT 1`) as {
    slug: string | null;
    name: string | null;
  }[];
  const r = rows[0];
  if (!r) return `event-${eventId}`;
  return r.slug ? r.slug : slugify(r.name ?? `event-${eventId}`);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const eventIdRaw = url.searchParams.get("eventId");
  const status = url.searchParams.get("status") as ApprovalStatus | "all" | null;
  const idsParam = url.searchParams.get("ids");

  const eventIdNum = Number(eventIdRaw);
  if (!Number.isFinite(eventIdNum) || eventIdNum <= 0) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  let photos;
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    photos = await getPhotosByIds(ids);
    photos = photos.filter((p) => p.event_id === eventIdNum);
  } else {
    const filter = status === "approved" || status === "pending" || status === "rejected" ? status : undefined;
    photos = await getEventPhotos(eventIdNum, filter);
  }

  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos to download" }, { status: 404 });
  }

  const slug = await eventSlug(eventIdNum);
  const tag = idsParam ? "selected" : status && status !== "all" ? status : "all";
  const zipName = `${slug}-photos-${tag}`;

  const { buffer, filename } = await generatePhotoZip(photos, zipName);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
