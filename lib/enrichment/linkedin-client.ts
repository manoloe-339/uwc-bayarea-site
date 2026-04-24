/**
 * Thin HTTP client for the Railway Python enrichment service.
 * Internal to lib/enrichment — other code should go through ./index.ts.
 */

import type { EnrichmentRequest, JobResponse } from "@/types/enrichment";
import { assertServiceUrl } from "./constants";

export async function startEnrichmentJob(
  neonId: number,
  data: EnrichmentRequest
): Promise<string> {
  const base = assertServiceUrl();
  const response = await fetch(`${base}/enrich`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      neon_id: neonId,
      linkedin_url: data.linkedin_url ?? null,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email ?? null,
      uwc_college: data.uwc_college ?? null,
      grad_year: data.grad_year ?? null,
      company: data.company ?? null,
      location: "San Francisco Bay Area",
    }),
  });
  if (!response.ok) {
    throw new Error(`Enrichment service returned ${response.status}`);
  }
  const body = (await response.json()) as { job_id: string };
  if (!body.job_id) {
    throw new Error("Enrichment service did not return a job_id");
  }
  return body.job_id;
}

export async function getJobStatus(jobId: string): Promise<JobResponse> {
  const base = assertServiceUrl();
  const response = await fetch(`${base}/enrich/${encodeURIComponent(jobId)}`);
  if (!response.ok) {
    throw new Error(`Job status check failed: ${response.status}`);
  }
  return (await response.json()) as JobResponse;
}
