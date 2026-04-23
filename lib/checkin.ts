import crypto from "crypto";
import { cookies } from "next/headers";
import { sql } from "./db";
import type { EventRecord } from "./events-db";

const TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/1/l/o confusion
const TOKEN_LENGTH = 8;

export function generateCheckinToken(): string {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

export async function getEventByCheckinToken(token: string): Promise<EventRecord | null> {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return null;
  const rows = (await sql`
    SELECT * FROM events WHERE checkin_token = ${normalized} LIMIT 1
  `) as EventRecord[];
  return rows[0] ?? null;
}

/**
 * Cookie name for the volunteer session. Scoped per token so a volunteer
 * who holds URLs for two different events has independent sessions.
 */
function pinCookieName(token: string): string {
  return `checkin_${token}`;
}

export async function hasValidPinCookie(event: EventRecord): Promise<boolean> {
  if (!event.checkin_token) return false;
  if (!event.checkin_pin) return true;
  const jar = await cookies();
  const raw = jar.get(pinCookieName(event.checkin_token))?.value;
  if (!raw) return false;
  // Store the PIN itself in the cookie (short-lived, HttpOnly) — simple
  // and avoids a secret-signing path for a 4-digit gate.
  return raw === event.checkin_pin;
}

export async function setPinCookie(event: EventRecord): Promise<void> {
  if (!event.checkin_token || !event.checkin_pin) return;
  const jar = await cookies();
  jar.set(pinCookieName(event.checkin_token), event.checkin_pin, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours — covers a long event
  });
}

export async function clearPinCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.delete(pinCookieName(token));
}

/**
 * Normalize a string for diacritic-insensitive search on the JS side —
 * used as a fallback / for QR payload parsing. DB-side searches use the
 * unaccent() Postgres function directly for speed.
 */
export function normalizeForSearch(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * In-memory rate limiter for "Sync Stripe from volunteer page". Scoped per
 * check-in token. 30-second floor — enough to stop a volunteer mashing the
 * button, loose enough for a real "new payment just came in" case.
 */
const lastSyncAt = new Map<string, number>();

export function rateLimitSync(token: string, minIntervalMs = 30_000): {
  ok: boolean;
  retryInSeconds: number;
} {
  const now = Date.now();
  const prev = lastSyncAt.get(token) ?? 0;
  const elapsed = now - prev;
  if (elapsed < minIntervalMs) {
    return { ok: false, retryInSeconds: Math.ceil((minIntervalMs - elapsed) / 1000) };
  }
  lastSyncAt.set(token, now);
  return { ok: true, retryInSeconds: 0 };
}
