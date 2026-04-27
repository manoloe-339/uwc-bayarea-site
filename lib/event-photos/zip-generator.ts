import JSZip from "jszip";
import type { EventPhoto } from "./types";

function safeFileName(p: EventPhoto, fallbackIndex: number): string {
  const original = (p.original_filename ?? "").trim();
  if (original) {
    const cleaned = original.replace(/[^\w.\-]+/g, "_");
    return `${String(p.id).padStart(5, "0")}_${cleaned}`;
  }
  const ext = (p.content_type ?? "").split("/")[1] || "jpg";
  return `${String(p.id).padStart(5, "0")}_photo_${fallbackIndex}.${ext}`;
}

export async function generatePhotoZip(
  photos: EventPhoto[],
  zipName: string
): Promise<{ buffer: Buffer; filename: string }> {
  const zip = new JSZip();
  const folder = zip.folder(zipName) ?? zip;

  await Promise.all(
    photos.map(async (p, idx) => {
      const res = await fetch(p.blob_url);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${p.blob_url}: ${res.status}`);
      }
      const arrayBuf = await res.arrayBuffer();
      folder.file(safeFileName(p, idx + 1), Buffer.from(arrayBuf));
    })
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, filename: `${zipName}.zip` };
}
