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

export async function scrapeLinkedinProfile(url: string): Promise<ApifyProfile | null> {
  const client = new ApifyClient({ token: requireEnv("APIFY_API_TOKEN") });
  const run = await client.actor(ENRICHMENT_CONFIG.APIFY_ACTOR_ID).call(
    { profileUrls: [url] },
    {
      timeout: ENRICHMENT_CONFIG.APIFY_RUN_TIMEOUT_SECS,
      memory: ENRICHMENT_CONFIG.APIFY_MEMORY_MB,
    }
  );
  if (!run.defaultDatasetId) {
    throw new Error("Apify run did not return a defaultDatasetId");
  }
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const first = (items as unknown as ApifyProfile[])[0];
  return first ?? null;
}
