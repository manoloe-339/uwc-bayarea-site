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
import { detectFocal } from "./detect";

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

/** Run detection over every pending row. Idempotent — call again and
 *  it does nothing because the rows now have photo_focal_at set. */
export async function runFocalBatch(): Promise<BatchResult> {
  const targets = (await sql`
    SELECT id, photo_url FROM alumni
     WHERE photo_url IS NOT NULL AND photo_focal_at IS NULL
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
      const focal = await detectFocal(buf);
      if (focal) {
        await sql`
          UPDATE alumni
             SET photo_focal_x = ${focal.x},
                 photo_focal_y = ${focal.y},
                 photo_focal_at = NOW()
           WHERE id = ${id}
        `;
        result.faces++;
      } else {
        // Mark processed-but-no-face so we don't retry it forever.
        await sql`
          UPDATE alumni
             SET photo_focal_x = NULL,
                 photo_focal_y = NULL,
                 photo_focal_at = NOW()
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
