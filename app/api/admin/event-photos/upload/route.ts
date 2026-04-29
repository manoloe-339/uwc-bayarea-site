import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { put, del } from "@vercel/blob";
import sharp from "sharp";
import { sql } from "@/lib/db";
import { recordPhoto } from "@/lib/event-photos/queries";
import { extractTakenAt } from "@/lib/event-photos/exif";

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
        // Middleware lets all POSTs to this path through (so the Vercel
        // Blob completion webhook can call us back without Basic Auth);
        // we enforce admin auth here on the user-initiated token branch.
        const expected = process.env.ADMIN_PASSWORD;
        if (!expected) throw new Error("Admin disabled");
        const authHeader = request.headers.get("authorization") || "";
        if (!authHeader.startsWith("Basic ")) {
          throw new Error("Authentication required");
        }
        try {
          const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
          const idx = decoded.indexOf(":");
          const pass = idx >= 0 ? decoded.slice(idx + 1) : decoded;
          if (pass !== expected) throw new Error("Authentication required");
        } catch {
          throw new Error("Authentication required");
        }

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
        console.log("[photo-upload] onUploadCompleted start", { eventId, originalFilename, blobUrl: blob.url, contentType: blob.contentType });
        try {

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

        // Extract EXIF capture date from the original buffer (HEIC conversion
        // strips metadata, so do this before any sharp pipeline runs).
        // Falls back to parsing the filename (WhatsApp, screenshots, etc.).
        const takenAt = await extractTakenAt(inputBuf, originalFilename);

        if (needsHeicConvert) {
          console.log("[photo-upload] HEIC branch: starting conversion", { originalFilename, inputBytes: inputBuf.length });
          // sharp's prebuilt binaries don't include HEIC decoding, so we run
          // the HEIC -> JPEG step through heic-convert (pure JS, works on
          // Vercel without native build flags). Sharp then handles orientation
          // and re-encoding the result. Dynamic import so any module-load
          // failure surfaces in this function's logs instead of breaking
          // the whole route at boot.
          let decodedBuf: Buffer;
          try {
            const heicConvertMod = await import("heic-convert");
            const heicConvert = heicConvertMod.default;
            const decoded = await heicConvert({
              buffer: inputBuf as unknown as ArrayBufferLike,
              format: "JPEG",
              quality: 0.9,
            });
            decodedBuf = Buffer.from(decoded);
            console.log("[photo-upload] HEIC decoded ok", { jpegBytes: decodedBuf.length });
          } catch (heicErr) {
            console.error("[photo-upload] HEIC decode FAILED", { originalFilename }, heicErr);
            throw heicErr;
          }
          const jpeg = await sharp(decodedBuf).rotate().jpeg({ quality: 88 }).toBuffer();
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
          taken_at: takenAt,
          uploaded_by_admin: true,
          approval_status: "pending",
        });
        console.log("[photo-upload] recordPhoto ok", { eventId, originalFilename, finalContentType, fileSize, width, height });
        } catch (err) {
          console.error("[photo-upload] onUploadCompleted FAILED", { eventId, originalFilename }, err);
          throw err;
        }
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
