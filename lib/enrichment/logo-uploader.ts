/**
 * Re-host any external image URL (school/company logos) to Vercel Blob
 * so we never serve from third-party CDNs. Used by:
 *
 *   - `applyProfile()` during enrichment, so new scrapes self-host
 *     immediately;
 *   - `scripts/backfill-logos.mjs`, which sweeps the existing DB.
 *
 * Storage key is deterministic — a SHA1 hash of the URL with its
 * query string stripped (LinkedIn URLs include an expiring signature,
 * but the path identifies the asset). That gives us:
 *   - de-dup across rows that share a logo (e.g. all 61 UWCSEA edu
 *     rows share one logo);
 *   - idempotent re-runs — re-uploading the same URL overwrites the
 *     same blob;
 *   - stable URLs we can cache forever.
 *
 * Returns the new public blob URL on success, null otherwise. The
 * caller decides whether to overwrite the DB row — typically yes,
 * because the LinkedIn URL will eventually 404 anyway.
 */

import crypto from "node:crypto";
import { put } from "@vercel/blob";

const KEY_PREFIX = "logos/";

/** Compute the storage key for a given source URL. Stable across
 * URL query-string variations (LinkedIn rotates the `?e=` expiry). */
export function logoStorageKey(sourceUrl: string): string {
  const stripped = sourceUrl.split("?")[0];
  const hash = crypto.createHash("sha1").update(stripped).digest("hex").slice(0, 24);
  // .jpg suffix is conventional — Vercel Blob doesn't use it for
  // content-type detection (the put() content-type comes from the
  // Blob), but a sensible extension helps when someone copy-pastes
  // a URL into a browser.
  return `${KEY_PREFIX}${hash}.jpg`;
}

/** True when the URL is one we should re-host. We skip:
 *   - URLs we already self-host (vercel-storage.com);
 *   - data: / blob: URIs (inline images);
 *   - URLs without a recognised scheme. */
export function shouldRehost(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return false;
  if (/^https?:\/\//i.test(trimmed) === false) return false;
  if (trimmed.includes("vercel-storage.com")) return false;
  return true;
}

/** Download `sourceUrl` and re-upload to Vercel Blob. Returns the
 * public blob URL, or null if anything went wrong (fetch failed,
 * blob upload failed, etc). */
export async function rehostLogo(
  sourceUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      // LinkedIn rejects requests without a UA that looks browser-y;
      // a generic one is enough.
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      return null;
    }
    const blob = await res.blob();
    if (blob.size === 0) return null;
    const key = logoStorageKey(sourceUrl);
    const uploaded = await put(key, blob, {
      access: "public",
      allowOverwrite: true,
    });
    return uploaded.url;
  } catch {
    return null;
  }
}

/**
 * Batch helper: re-host an array of URLs, deduplicating by URL so the
 * same logo isn't uploaded twice in a single batch. Returns a map of
 * sourceUrl → blobUrl (or null when the upload failed). */
export async function rehostLogos(
  sourceUrls: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, string | null>> {
  const unique = new Set<string>();
  for (const u of sourceUrls) if (shouldRehost(u)) unique.add(u as string);
  const entries = Array.from(unique);
  const results = await Promise.all(entries.map((u) => rehostLogo(u)));
  const out = new Map<string, string | null>();
  for (let i = 0; i < entries.length; i++) out.set(entries[i], results[i]);
  return out;
}
