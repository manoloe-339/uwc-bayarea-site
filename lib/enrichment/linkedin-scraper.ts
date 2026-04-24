/**
 * Thin wrapper over the Apify Linkedin-Profile-Scraper actor. Given a
 * LinkedIn URL, returns the raw profile items. Errors bubble up so the
 * caller can mark the alumni row appropriately.
 *
 * CAVEAT: profilePic / profilePicHighQuality URLs in the response are
 * JWT-signed CDN links that expire. Caller must download them
 * immediately (see photo-uploader.ts).
 */

// Force Vercel's file tracer to bundle proxy-agent. apify-client uses it
// via dynamic require() which @vercel/nft can't follow; without this
// static import the serverless deployment omits node_modules/proxy-agent
// entirely and throws "Cannot find module 'proxy-agent'" at first call.
import "proxy-agent";
import { ApifyClient } from "apify-client";
import type { ApifyProfile } from "@/types/enrichment";
import { ENRICHMENT_CONFIG, requireEnv } from "./constants";

export type ScrapeResult =
  | { ok: true; profile: ApifyProfile; runId: string }
  | { ok: false; reason: string; runId: string | null; logTail: string | null };

export async function scrapeLinkedinProfile(url: string): Promise<ScrapeResult> {
  const client = new ApifyClient({ token: requireEnv("APIFY_API_TOKEN") });
  const run = await client.actor(ENRICHMENT_CONFIG.APIFY_ACTOR_ID).call(
    { profileUrls: [url] },
    {
      timeout: ENRICHMENT_CONFIG.APIFY_RUN_TIMEOUT_SECS,
      memory: ENRICHMENT_CONFIG.APIFY_MEMORY_MB,
    }
  );
  if (!run.defaultDatasetId) {
    return {
      ok: false,
      reason: "Apify run did not return a defaultDatasetId",
      runId: run.id ?? null,
      logTail: null,
    };
  }
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const first = (items as unknown as ApifyProfile[])[0];
  if (!first) {
    // Pull the last ~2KB of the run log so the admin can see WHY the
    // actor returned nothing (LinkedIn CAPTCHA, login required, etc.)
    // instead of the unhelpful "no profile data" string.
    let logTail: string | null = null;
    try {
      const stream = await client.log(run.id).get();
      if (typeof stream === "string") {
        logTail = stream.slice(-2000);
      }
    } catch (err) {
      console.error("[enrichment] could not fetch run log:", err);
    }
    return { ok: false, reason: "Apify returned zero profile items", runId: run.id, logTail };
  }
  return { ok: true, profile: first, runId: run.id };
}
