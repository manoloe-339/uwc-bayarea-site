import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const LOCK_KEY = "email:send_lock";
const LOCK_TTL_SECONDS = 300; // safety auto-release after 5 min

/** Acquire the global send lock. Returns true if acquired, false if another send is in flight. */
export async function acquireSendLock(): Promise<boolean> {
  const res = await redis.set(LOCK_KEY, new Date().toISOString(), {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return res === "OK";
}

export async function releaseSendLock(): Promise<void> {
  await redis.del(LOCK_KEY);
}
