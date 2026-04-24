/**
 * Public surface of lib/enrichment. Fire-and-forget entry point —
 * orchestrates the full inline pipeline in one call:
 *
 *   1. Scenario A (have linkedin_url): skip discovery, scrape directly.
 *   2. Scenario B (no url): Serper + Exa fan-out → Claude picks best →
 *      scrape winner. If Claude declines, mark needs_review with the
 *      candidate list stashed in linkedin_raw_data.
 *   3. Transform Apify response → alumni + child-table writes.
 *   4. Download profile photo to Vercel Blob (CDN URLs expire).
 *
 * The signup action wraps this in Next 15 after() so /thanks renders
 * immediately while enrichment continues in the background.
 */

import { sql } from "@/lib/db";
import type {
  ApifyProfile,
  EnrichmentRequest,
  LinkedinCandidate,
  MatchDecision,
} from "@/types/enrichment";
import {
  buildAlumniPatch,
  buildCareerRows,
  buildEducationRows,
  buildVolunteeringRows,
  type CareerRow,
  type EducationRow,
  type VolunteeringRow,
} from "./data-transformer";
import { scrapeLinkedinProfile } from "./linkedin-scraper";
import { discoverCandidates } from "./linkedin-search";
import { pickBestCandidate } from "./claude-matcher";
import { downloadAndUploadPhoto } from "./photo-uploader";

type FinalStatus = "complete" | "failed" | "needs_review";

async function markPending(neonId: number): Promise<void> {
  await sql`
    UPDATE alumni SET
      linkedin_enrichment_status = 'pending',
      linkedin_enrichment_job_id = NULL,
      linkedin_enrichment_error  = NULL,
      updated_at                 = NOW()
    WHERE id = ${neonId}
  `;
}

async function markFailed(neonId: number, reason: string): Promise<void> {
  console.error(`[enrichment] failed for ${neonId}: ${reason}`);
  await sql`
    UPDATE alumni SET
      linkedin_enrichment_status = 'failed',
      linkedin_enrichment_error  = ${reason},
      linkedin_enriched_at       = NOW(),
      updated_at                 = NOW()
    WHERE id = ${neonId}
  `;
}

async function markNeedsReview(
  neonId: number,
  reason: string,
  rawData: unknown
): Promise<void> {
  await sql`
    UPDATE alumni SET
      linkedin_enrichment_status = 'needs_review',
      linkedin_enrichment_error  = ${reason},
      linkedin_raw_data          = ${JSON.stringify(rawData)}::jsonb,
      linkedin_enriched_at       = NOW(),
      updated_at                 = NOW()
    WHERE id = ${neonId}
  `;
}

async function writeChildRows(
  neonId: number,
  education: EducationRow[],
  career: CareerRow[],
  volunteering: VolunteeringRow[]
): Promise<void> {
  // Replace-not-merge: nuke any previous LinkedIn-sourced rows and
  // re-insert. Simpler than diffing and correct for a re-enrich flow.
  await sql`DELETE FROM alumni_education  WHERE alumni_id = ${neonId}`;
  await sql`DELETE FROM alumni_career     WHERE alumni_id = ${neonId}`;
  await sql`DELETE FROM alumni_volunteering WHERE alumni_id = ${neonId}`;

  for (const e of education) {
    await sql`
      INSERT INTO alumni_education (
        alumni_id, position, school, school_id, school_linkedin_url,
        degree_field, start_year, end_year, is_uwc
      ) VALUES (
        ${neonId}, ${e.position}, ${e.school}, ${e.school_id}, ${e.school_linkedin_url},
        ${e.degree_field}, ${e.start_year}, ${e.end_year}, ${e.is_uwc}
      )
    `;
  }
  for (const c of career) {
    await sql`
      INSERT INTO alumni_career (
        alumni_id, position, title, company, company_linkedin_url,
        company_industry, company_size, company_website,
        start_date, end_date, location, is_current
      ) VALUES (
        ${neonId}, ${c.position}, ${c.title}, ${c.company}, ${c.company_linkedin_url},
        ${c.company_industry}, ${c.company_size}, ${c.company_website},
        ${c.start_date}, ${c.end_date}, ${c.location}, ${c.is_current}
      )
    `;
  }
  for (const v of volunteering) {
    await sql`
      INSERT INTO alumni_volunteering (
        alumni_id, organization, role, industry, start_year, end_year, is_current
      ) VALUES (
        ${neonId}, ${v.organization}, ${v.role}, ${v.industry},
        ${v.start_year}, ${v.end_year}, ${v.is_current}
      )
    `;
  }
}

async function applyProfile(
  neonId: number,
  profile: ApifyProfile
): Promise<FinalStatus> {
  // Re-host photo before we touch anything else — the LinkedIn CDN URL
  // is a JWT-signed link that expires within minutes.
  let photoUrl: string | null = null;
  const sourcePhoto = profile.profilePicHighQuality ?? profile.profilePic ?? null;
  if (sourcePhoto) {
    photoUrl = await downloadAndUploadPhoto(sourcePhoto, neonId);
  }

  const patch = buildAlumniPatch(profile, photoUrl);
  const eduRows = buildEducationRows(profile.educations);
  const careerRows = buildCareerRows(profile.experiences);
  const volRows = buildVolunteeringRows(profile.volunteerAndAwards);

  await sql`
    UPDATE alumni SET
      linkedin_url              = COALESCE(NULLIF(${patch.linkedin_url}, ''), linkedin_url),
      linkedin_alternate_email  = COALESCE(${patch.linkedin_alternate_email}, linkedin_alternate_email),
      headline                  = COALESCE(${patch.headline}, headline),
      about                     = COALESCE(${patch.about}, about),
      linkedin_about            = COALESCE(${patch.about}, linkedin_about),
      location_city             = COALESCE(${patch.location_city}, location_city),
      location_country          = COALESCE(${patch.location_country}, location_country),
      location_full             = COALESCE(${patch.location_full}, location_full),
      photo_url                 = COALESCE(${patch.photo_url}, photo_url),
      current_title             = COALESCE(${patch.current_title}, current_title),
      current_company           = COALESCE(${patch.current_company}, current_company),
      current_company_linkedin  = COALESCE(${patch.current_company_linkedin}, current_company_linkedin),
      current_company_industry  = COALESCE(${patch.current_company_industry}, current_company_industry),
      current_company_size      = COALESCE(${patch.current_company_size}, current_company_size),
      current_company_website   = COALESCE(${patch.current_company_website}, current_company_website),
      current_location          = COALESCE(${patch.current_location}, current_location),
      current_since             = COALESCE(${patch.current_since}, current_since),
      total_experience_years    = COALESCE(${patch.total_experience_years}, total_experience_years),
      first_role_year           = COALESCE(${patch.first_role_year}, first_role_year),
      uwc_verified              = ${patch.uwc_verified},
      uwc_school_matched        = COALESCE(${patch.uwc_school_matched}, uwc_school_matched),
      linkedin_enrichment_status = 'complete',
      linkedin_enrichment_error  = NULL,
      linkedin_enriched_at       = NOW(),
      linkedin_raw_data          = ${JSON.stringify(profile)}::jsonb,
      updated_at                 = NOW()
    WHERE id = ${neonId}
  `;
  try {
    await writeChildRows(neonId, eduRows, careerRows, volRows);
  } catch (err) {
    console.error(`[enrichment] child-row write failed for ${neonId}:`, err);
    // Don't flip status to failed — the main alumni row is already good.
  }
  console.log(`[enrichment] ✓ complete for alumni ${neonId}`);
  return "complete";
}

export async function triggerEnrichment(
  neonId: number,
  data: EnrichmentRequest
): Promise<void> {
  try {
    await markPending(neonId);

    let targetUrl = data.linkedin_url?.trim() || null;
    let candidateStash: { decision?: MatchDecision; candidates?: LinkedinCandidate[] } = {};

    // Scenario B: discover a candidate first.
    if (!targetUrl) {
      const { candidates, bioSnippets } = await discoverCandidates({
        name: `${data.first_name} ${data.last_name}`.trim(),
        college: data.uwc_college ?? null,
        location: null,
        email: data.email ?? null,
      });
      candidateStash.candidates = candidates;
      if (candidates.length === 0) {
        await markFailed(neonId, "No LinkedIn candidates found");
        return;
      }
      const decision = await pickBestCandidate({
        fullName: `${data.first_name} ${data.last_name}`.trim(),
        college: data.uwc_college ?? null,
        currentRole: data.company ?? null,
        location: null,
        email: data.email ?? null,
        sector: null,
        gradYear: data.grad_year ?? null,
        candidates,
        bioSnippets,
      });
      candidateStash.decision = decision;
      if (!decision.chosen_url) {
        await markNeedsReview(
          neonId,
          `No confident match (${decision.confidence}): ${decision.reasoning}`,
          candidateStash
        );
        return;
      }
      targetUrl = decision.chosen_url;
    }

    // Scenario A (given URL) or Scenario B (Claude picked): scrape.
    const result = await scrapeLinkedinProfile(targetUrl);
    if (!result.ok) {
      await markNeedsReview(
        neonId,
        `Apify: ${result.reason} (run ${result.runId ?? "?"})`,
        {
          attemptedUrl: targetUrl,
          apifyRunId: result.runId,
          apifyLogTail: result.logTail,
          ...candidateStash,
        }
      );
      return;
    }
    await applyProfile(neonId, result.profile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await markFailed(neonId, msg);
  }
}

export type {
  EnrichmentRequest,
  EnrichmentResult,
  EnrichmentStatus,
} from "@/types/enrichment";
