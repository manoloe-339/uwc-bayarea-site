import { sql } from "./db";
import { classifyGender, type GenderInput } from "./gender-classifier";

export type GenderAlum = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  origin: string | null;
  headline: string | null;
  linkedin_about: string | null;
  gender: string | null;
  gender_confidence: number | null;
  gender_source: string | null;
};

export async function listAlumniForGenderReview(): Promise<GenderAlum[]> {
  return (await sql`
    SELECT id, first_name, last_name, origin, headline, linkedin_about,
           gender, gender_confidence, gender_source
    FROM alumni
    WHERE deceased IS NOT TRUE
    ORDER BY id
  `) as GenderAlum[];
}

export async function classifyAllGenders(opts: {
  onlyUnclassified: boolean;
  concurrency?: number;
  onProgress?: (done: number, total: number, name: string) => void;
}): Promise<{ classified: number; failed: number; skipped: number }> {
  const all = await listAlumniForGenderReview();
  const targets = opts.onlyUnclassified
    ? all.filter((a) => a.gender == null || a.gender_source !== "admin")
    : all;
  // Never re-classify alumni whose gender was set by admin override.
  const usable = targets.filter((a) => a.gender_source !== "admin");
  const total = usable.length;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 5, 10));

  let classified = 0;
  let failed = 0;
  let cursor = 0;
  const next = () => (cursor < usable.length ? usable[cursor++] : null);

  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (true) {
          const a = next();
          if (!a) return;
          if (!a.first_name || !a.first_name.trim()) {
            await sql`
              UPDATE alumni SET gender = 'unknown', gender_confidence = 0, gender_source = 'llm'
              WHERE id = ${a.id}
            `;
            classified++;
            opts.onProgress?.(classified + failed, total, "");
            continue;
          }
          const input: GenderInput = {
            firstName: a.first_name,
            lastName: a.last_name,
            origin: a.origin,
            headline: a.headline,
            linkedinAbout: a.linkedin_about,
          };
          const res = await classifyGender(input);
          if (res.ok) {
            await sql`
              UPDATE alumni SET
                gender = ${res.data.gender},
                gender_confidence = ${res.data.confidence},
                gender_source = 'llm'
              WHERE id = ${a.id}
            `;
            classified++;
          } else {
            failed++;
          }
          opts.onProgress?.(classified + failed, total, a.first_name);
        }
      })()
    );
  }
  await Promise.all(workers);
  return { classified, failed, skipped: all.length - usable.length };
}

export async function setGenderManual(id: number, gender: string | null): Promise<void> {
  const allowed = new Set(["male", "female", "they", "unknown"]);
  const value = gender && allowed.has(gender) ? gender : null;
  await sql`
    UPDATE alumni SET
      gender = ${value},
      gender_confidence = ${value == null ? null : 1.0},
      gender_source = 'admin',
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

