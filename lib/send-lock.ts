import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const GLOBAL_LOCK_KEY = "email:send_lock";
const LOCK_TTL_SECONDS = 600; // safety auto-release after 10 min

/** Acquire the global send lock. Returns true if acquired, false if another send is in flight. */
export async function acquireSendLock(): Promise<boolean> {
  const res = await redis.set(GLOBAL_LOCK_KEY, new Date().toISOString(), {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return res === "OK";
}

export async function releaseSendLock(): Promise<void> {
  await redis.del(GLOBAL_LOCK_KEY);
}

/** Per-campaign lock — prevents the same campaign firing twice even if a global send is allowed. */
export async function acquireCampaignLock(campaignId: string): Promise<boolean> {
  const res = await redis.set(`email:campaign_lock:${campaignId}`, new Date().toISOString(), {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return res === "OK";
}

export async function releaseCampaignLock(campaignId: string): Promise<void> {
  await redis.del(`email:campaign_lock:${campaignId}`);
}
