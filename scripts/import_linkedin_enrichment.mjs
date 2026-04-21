import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// CLI flags
//   --source <dir>    directory containing bay_area_enriched.json and
//                     bay_area_enrichment_errors.json and photos/ (default:
//                     ../uwc-alumni-search)
//   --dry-run         show what would change, no writes
//   --skip-photos     process profile data only, no photo upload
//   --photos-only     skip profile data, only upload photos
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipPhotos = args.includes("--skip-photos");
const photosOnly = args.includes("--photos-only");
const sourceIdx = args.indexOf("--source");
const sourceDir = sourceIdx >= 0 ? args[sourceIdx + 1] : "/Users/manoloespinosa/Projects/uwc-alumni-search";

const enrichedPath = join(sourceDir, "bay_area_enriched.json");
const errorsPath = join(sourceDir, "bay_area_enrichment_errors.json");
const photosDir = join(sourceDir, "photos");

for (const p of [enrichedPath]) {
  if (!existsSync(p)) {
    console.error(`Required file missing: ${p}`);
    process.exit(1);
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set — run `vercel env pull .env.local` first.");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

const enriched = JSON.parse(readFileSync(enrichedPath, "utf8"));
const errors = existsSync(errorsPath) ? JSON.parse(readFileSync(errorsPath, "utf8")) : [];
console.log(`Loaded ${enriched.length} enriched + ${errors.length} error rows from ${sourceDir}`);

// ---------------------------------------------------------------------------
// Photo upload
// ---------------------------------------------------------------------------

let blobPut = null;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

async function ensureBlobClient() {
  if (skipPhotos) return null;
  if (blobPut) return blobPut;
  if (!BLOB_TOKEN) {
    console.log(
      "⚠  BLOB_READ_WRITE_TOKEN not set — skipping photo uploads. Profile data will still import."
    );
    console.log(
      "   To enable later: add the Blob integration in Vercel dashboard, pull env, rerun with --photos-only."
    );
    return null;
  }
  const m = await import("@vercel/blob");
  blobPut = m.put;
  return blobPut;
}

async function uploadPhoto(neonId, relPath) {
  if (!relPath) return null;
  const absPath = join(sourceDir, relPath);
  if (!existsSync(absPath)) {
    console.warn(`  photo missing on disk: ${absPath}`);
    return null;
  }
  const put = await ensureBlobClient();
  if (!put) return null;
  const buf = readFileSync(absPath);
  const key = `alumni/${neonId}${extname(absPath).toLowerCase()}`;
  const { url } = await put(key, buf, {
    access: "public",
    contentType: mimeFromExt(extname(absPath)),
    token: BLOB_TOKEN,
    allowOverwrite: true,
  });
  return url;
}

function mimeFromExt(ext) {
  const e = ext.toLowerCase().replace(".", "");
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Row handlers
// ---------------------------------------------------------------------------

// Overwrite-safe: we only fill empty fields in alumni, never clobber. For the
// three child tables we delete-then-insert scoped to this alumni_id so
// re-runs stay idempotent without double rows.
async function upsertProfile(row) {
  const id = row.neon_id;
  if (typeof id !== "number") return { skipped: true, reason: "no neon_id" };

  const loc = row.location ?? {};
  const cr = row.current_role ?? {};

  if (dryRun) {
    return { dry: true, id };
  }

  // Update scalar fields. Each COALESCE preserves whatever's already there
  // (NULL-only overwrite) so manual edits are respected. Only linkedin_url,
  // location_full, etc. that should always reflect the latest enrichment use
  // plain assignment — but even for those, we respect existing non-null data
  // by passing null from the ingest when the enrichment value is empty.
  await sql`
    UPDATE alumni SET
      linkedin_url              = COALESCE(linkedin_url, ${row.linkedin_url ?? null}),
      linkedin_alternate_email  = COALESCE(linkedin_alternate_email, ${row.alternate_email ?? null}),
      headline                  = COALESCE(headline, ${row.headline ?? null}),
      linkedin_about            = COALESCE(linkedin_about, ${row.about ?? null}),
      location_full             = COALESCE(location_full, ${loc.full ?? null}),
      location_city             = COALESCE(location_city, ${loc.city ?? null}),
      location_country          = COALESCE(location_country, ${loc.country ?? null}),
      current_title             = COALESCE(current_title, ${cr.title ?? null}),
      current_company           = COALESCE(current_company, ${cr.company ?? null}),
      current_company_id        = COALESCE(current_company_id, ${cr.company_id ?? null}),
      current_company_linkedin  = COALESCE(current_company_linkedin, ${cr.company_linkedin_url ?? null}),
      current_company_industry  = COALESCE(current_company_industry, ${cr.company_industry ?? null}),
      current_company_size      = COALESCE(current_company_size, ${cr.company_size ?? null}),
      current_company_website   = COALESCE(current_company_website, ${cr.company_website ?? null}),
      current_location          = COALESCE(current_location, ${cr.location ?? null}),
      current_since             = COALESCE(current_since, ${cr.start ?? cr.start_date ?? null}),
      uwc_verified              = ${row.uwc_verified ?? false},
      uwc_school_matched        = COALESCE(uwc_school_matched, ${row.uwc_school_matched ?? null}),
      total_experience_years    = ${row.total_experience_years ?? null},
      first_role_year           = ${row.first_role_year ?? null},
      enriched_at               = ${row.scraped_at ?? null},
      enrichment_source         = ${row.meta?.actor ?? null}
    WHERE id = ${id}
  `;

  // Child tables — replace-all for this alumni_id.
  await sql`DELETE FROM alumni_career WHERE alumni_id = ${id}`;
  let pos = 0;
  for (const c of row.career_history ?? []) {
    await sql`
      INSERT INTO alumni_career
        (alumni_id, position, title, company, company_id, company_linkedin_url,
         company_industry, company_size, company_website, start_date, end_date,
         location, is_current)
      VALUES
        (${id}, ${pos}, ${c.title ?? null}, ${c.company ?? null}, ${c.company_id ?? null},
         ${c.company_linkedin_url ?? null}, ${c.company_industry ?? null},
         ${c.company_size ?? null}, ${c.company_website ?? null},
         ${c.start ?? c.start_date ?? null}, ${c.end ?? c.end_date ?? null}, ${c.location ?? null},
         ${!!(c.current ?? c.is_current)})
    `;
    pos++;
  }

  await sql`DELETE FROM alumni_education WHERE alumni_id = ${id}`;
  pos = 0;
  for (const e of row.education ?? []) {
    const isUwc = (e.school ?? "").match(/\bUWC\b|\bUnited World Coll/i) !== null;
    await sql`
      INSERT INTO alumni_education
        (alumni_id, position, school, school_id, school_linkedin_url,
         degree_field, start_year, end_year, is_uwc)
      VALUES
        (${id}, ${pos}, ${e.school ?? "(unknown)"}, ${e.school_id ?? null},
         ${e.school_linkedin_url ?? null}, ${e.degree_field ?? null},
         ${e.start_year ?? null}, ${e.end_year ?? null}, ${isUwc})
    `;
    pos++;
  }

  await sql`DELETE FROM alumni_volunteering WHERE alumni_id = ${id}`;
  for (const v of row.volunteering ?? []) {
    await sql`
      INSERT INTO alumni_volunteering
        (alumni_id, organization, role, industry, start_year, end_year, is_current)
      VALUES
        (${id}, ${v.organization ?? null}, ${v.role ?? null}, ${v.industry ?? null},
         ${v.start_year ?? null}, ${v.end_year ?? null}, ${!!(v.current ?? v.is_current)})
    `;
  }

  return { ok: true, id, career: (row.career_history ?? []).length,
           education: (row.education ?? []).length,
           volunteering: (row.volunteering ?? []).length };
}

async function handleError(row) {
  // Enrichment-errored rows still have a verified linkedin_url.
  if (!dryRun) {
    await sql`
      UPDATE alumni SET linkedin_url = COALESCE(linkedin_url, ${row.linkedin_url ?? null})
      WHERE id = ${row.neon_id}
    `;
  }
  return { ok: true, id: row.neon_id, errorRecord: true };
}

async function handlePhoto(row) {
  if (skipPhotos) return null;
  if (!row.photo_local_path) return null;
  try {
    const url = await uploadPhoto(row.neon_id, row.photo_local_path);
    if (!url) return null;
    if (!dryRun) {
      await sql`UPDATE alumni SET photo_url = ${url} WHERE id = ${row.neon_id}`;
    }
    return url;
  } catch (err) {
    console.warn(`  photo upload failed for #${row.neon_id}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------

if (dryRun) console.log("\n[DRY RUN] — no writes will happen.\n");

let ok = 0, failed = 0, photosUploaded = 0, photosSkipped = 0;

if (!photosOnly) {
  console.log("\n── Profile data ──");
  for (const row of enriched) {
    try {
      const res = await upsertProfile(row);
      if (res.ok || res.dry) {
        ok++;
        if (ok <= 5 || ok % 50 === 0) {
          console.log(
            `  ${res.dry ? "·" : "✓"} #${res.id}  career=${res.career ?? 0}  edu=${res.education ?? 0}  vol=${res.volunteering ?? 0}`
          );
        }
      } else if (res.skipped) {
        failed++;
        console.log(`  − skipped: ${res.reason}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ #${row.neon_id} failed: ${err.message}`);
    }
  }
  for (const row of errors) {
    try {
      await handleError(row);
      ok++;
    } catch (err) {
      failed++;
      console.error(`  ✗ error-row #${row.neon_id} failed: ${err.message}`);
    }
  }
  console.log(`  Profile data: ${ok} ok, ${failed} failed`);
}

if (!skipPhotos) {
  console.log("\n── Photos ──");
  await ensureBlobClient();
  if (!BLOB_TOKEN) {
    console.log("  (skipped — no BLOB_READ_WRITE_TOKEN)");
  } else {
    for (const row of enriched) {
      if (!row.photo_local_path) {
        photosSkipped++;
        continue;
      }
      try {
        const url = await handlePhoto(row);
        if (url) {
          photosUploaded++;
          if (photosUploaded <= 3 || photosUploaded % 50 === 0) {
            console.log(`  ✓ #${row.neon_id} → ${url}`);
          }
        } else {
          photosSkipped++;
        }
      } catch (err) {
        photosSkipped++;
        console.warn(`  − #${row.neon_id} skipped: ${err.message}`);
      }
    }
    console.log(`  Photos: ${photosUploaded} uploaded, ${photosSkipped} skipped`);
  }
}

console.log("\nDone.");
