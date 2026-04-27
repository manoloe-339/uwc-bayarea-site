import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { put, del } from "@vercel/blob";
import sharp from "sharp";
import { sql } from "@/lib/db";
import { recordPhoto } from "@/lib/event-photos/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB per photo

type TokenPayload = {
  eventId: number;
  originalFilename: string | null;
  contentType: string | null;
};

function isHeic(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const lc = contentType.toLowerCase();
  return lc === "image/heic" || lc === "image/heif";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let parsed: { eventId?: unknown; originalFilename?: unknown; contentType?: unknown } = {};
        if (clientPayload) {
          try {
            parsed = JSON.parse(clientPayload);
          } catch {
            throw new Error("Invalid client payload");
          }
        }
        const eventIdNum = Number(parsed.eventId);
        if (!Number.isFinite(eventIdNum) || eventIdNum <= 0) {
          throw new Error("Missing or invalid eventId");
        }
        const rows = (await sql`SELECT id FROM events WHERE id = ${eventIdNum} LIMIT 1`) as { id: number }[];
        if (rows.length === 0) {
          throw new Error("Event not found");
        }
        const tokenPayload: TokenPayload = {
          eventId: eventIdNum,
          originalFilename: typeof parsed.originalFilename === "string" ? parsed.originalFilename : null,
          contentType: typeof parsed.contentType === "string" ? parsed.contentType : null,
        };
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          tokenPayload: JSON.stringify(tokenPayload),
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const meta = (tokenPayload ? JSON.parse(tokenPayload) : {}) as TokenPayload;
        const { eventId, originalFilename } = meta;

        let finalUrl = blob.url;
        let finalPathname = blob.pathname;
        let finalContentType: string | null = blob.contentType ?? meta.contentType ?? null;
        let width: number | null = null;
        let height: number | null = null;
        let fileSize: number | null = null;

        const needsHeicConvert = isHeic(finalContentType) ||
          (originalFilename ? /\.(heic|heif)$/i.test(originalFilename) : false);

        const fetched = await fetch(blob.url);
        if (!fetched.ok) throw new Error(`Failed to fetch uploaded blob: ${fetched.status}`);
        const inputBuf = Buffer.from(await fetched.arrayBuffer());

        if (needsHeicConvert) {
          const jpeg = await sharp(inputBuf).rotate().jpeg({ quality: 88 }).toBuffer();
          const meta2 = await sharp(jpeg).metadata();
          width = meta2.width ?? null;
          height = meta2.height ?? null;
          fileSize = jpeg.length;
          finalContentType = "image/jpeg";

          const newPathname = `events/${eventId}/photos/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}.jpg`;
          const reput = await put(newPathname, jpeg, {
            access: "public",
            contentType: "image/jpeg",
            addRandomSuffix: false,
            allowOverwrite: false,
          });
          finalUrl = reput.url;
          finalPathname = reput.pathname;

          // Best-effort delete of original HEIC blob.
          try {
            await del(blob.url);
          } catch {
            // ignore
          }
        } else {
          try {
            const meta2 = await sharp(inputBuf).metadata();
            width = meta2.width ?? null;
            height = meta2.height ?? null;
          } catch {
            // some content types (e.g. gif) may fail metadata; that's OK
          }
          fileSize = inputBuf.length;
        }

        await recordPhoto({
          event_id: eventId,
          blob_url: finalUrl,
          blob_pathname: finalPathname,
          original_filename: originalFilename,
          file_size_bytes: fileSize,
          content_type: finalContentType,
          width,
          height,
          uploaded_by_admin: true,
          approval_status: "approved",
        });
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
