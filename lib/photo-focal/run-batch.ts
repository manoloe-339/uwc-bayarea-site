/**
 * Batch runner for the focal-point pipeline. Pulls every alum with a
 * photo and no focal timestamp, runs face detection on each, and
 * writes the result. After this completes the unprocessed count is 0,
 * so the threshold check at the end of enrichment won't fire again
 * until new signups / refreshed photos accumulate another ten.
 *
 * Runs serially: the WASM backend is single-threaded and concurrent
 * tensor allocations under load tend to OOM the function.
 */
import { sql } from "@/lib/db";
import { detectFace } from "./detect";
import { bakeHeadshot } from "./headshot";

export type BatchResult = {
  scanned: number;
  faces: number;
  noFace: number;
  failed: number;
};

async function fetchImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function pendingFocalCount(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM alumni
     WHERE photo_url IS NOT NULL AND photo_focal_at IS NULL
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

/** Run detection over every pending row. Picks up two cases:
 *  - photo_focal_at IS NULL — newly added / refreshed photo
 *  - photo_headshot_url IS NULL with focal set — pre-existing rows
 *    that were detected before headshot baking landed
 *  Idempotent — after a successful pass both columns are filled. */
export async function runFocalBatch(): Promise<BatchResult> {
  const targets = (await sql`
    SELECT id, photo_url FROM alumni
     WHERE photo_url IS NOT NULL
       AND (photo_focal_at IS NULL OR photo_headshot_url IS NULL)
     ORDER BY id
  `) as Array<{ id: number; photo_url: string }>;

  const result: BatchResult = {
    scanned: targets.length,
    faces: 0,
    noFace: 0,
    failed: 0,
  };
  if (targets.length === 0) return result;

  console.log(`[focal] starting batch over ${targets.length} alumni`);
  for (const { id, photo_url } of targets) {
    try {
      const buf = await fetchImage(photo_url);
      const face = await detectFace(buf);
      if (face) {
        // Bake the head-focused crop while we still have the buffer
        // and the face box in hand — single round-trip per alum.
        let headshotUrl: string | null = null;
        try {
          headshotUrl = await bakeHeadshot(buf, face, id);
        } catch (err) {
          // Don't fail the focal write just because the headshot
          // derivative couldn't be built — the directory still
          // renders correctly off the focal coords alone.
          console.error(`[focal] ${id} headshot bake failed:`, err);
        }
        await sql`
          UPDATE alumni
             SET photo_focal_x = ${face.focalX},
                 photo_focal_y = ${face.focalY},
                 photo_focal_at = NOW(),
                 photo_headshot_url = ${headshotUrl}
           WHERE id = ${id}
        `;
        result.faces++;
      } else {
        // Processed-but-no-face: mark so we don't retry it forever,
        // and wipe any stale headshot from a prior detection.
        await sql`
          UPDATE alumni
             SET photo_focal_x = NULL,
                 photo_focal_y = NULL,
                 photo_focal_at = NOW(),
                 photo_headshot_url = NULL
           WHERE id = ${id}
        `;
        result.noFace++;
      }
    } catch (err) {
      result.failed++;
      console.error(`[focal] ${id} failed:`, err);
    }
  }
  console.log(
    `[focal] done · faces=${result.faces} no-face=${result.noFace} failed=${result.failed}`,
  );
  return result;
}
