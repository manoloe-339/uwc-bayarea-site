/**
 * Downloads the LinkedIn-provided photo URL and re-uploads to Vercel
 * Blob so it survives LinkedIn's CDN rotation and so we serve it from
 * our own domain. Returns null on any failure so enrichment can still
 * complete without a photo.
 */

import { put } from "@vercel/blob";
import { ENRICHMENT_CONFIG } from "./constants";

export async function downloadAndUploadPhoto(
  photoUrl: string,
  alumniId: number
): Promise<string | null> {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) {
      console.error(`[enrichment] photo fetch ${alumniId}: ${res.status}`);
      return null;
    }
    const blob = await res.blob();
    const key = `${ENRICHMENT_CONFIG.PHOTO_STORAGE_PREFIX}${alumniId}.jpg`;
    const uploaded = await put(key, blob, {
      access: "public",
      // Overwrite any prior photo for this alumnus so we don't leak
      // orphaned blobs. addRandomSuffix=true would bust caches but the
      // UI already cache-busts on updated_at, so a stable key is fine.
      allowOverwrite: true,
    });
    return uploaded.url;
  } catch (err) {
    console.error(`[enrichment] photo upload ${alumniId}:`, err);
    return null;
  }
}
