import { Redis } from "@upstash/redis";
import { event } from "./event";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const TICKETS_SOLD_KEY = "tickets_sold";

export async function getTicketsSold(): Promise<number> {
  try {
    const v = await redis.get<number>(TICKETS_SOLD_KEY);
    return typeof v === "number" ? v : v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

export async function incrementTicketsSold(by = 1): Promise<number> {
  return await redis.incrby(TICKETS_SOLD_KEY, by);
}

export async function getSeatsRemaining(): Promise<number> {
  const sold = await getTicketsSold();
  return Math.max(0, event.totalSeats - sold);
}
