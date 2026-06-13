/**
 * Short-lived signed token embedded in the signup-confirmation email
 * link to /join-whatsapp. When present, the page knows it can trust
 * the alumni_id encoded in the token, prefills the email, and shows
 * a one-click "Send WhatsApp invite to me" button — no need for the
 * recipient to retype their name or have an admin manually approve.
 *
 * Format: `<base64url(payload)>.<base64url(hmac)>` — same shape as
 * the directory cookie signer, deliberately stateless so we don't
 * need a tokens table. HMAC-SHA256 with a secret derived from
 * DIRECTORY_PASSWORD (the env var is already required server-side).
 *
 * The token only carries the alumni_id + an expiry. Email + name are
 * looked up at verification time so a user who updates their email
 * after signup still receives the invite at their current address.
 */

type Payload = { aid: number; exp: number };

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function secret(): string {
  const s = process.env.DIRECTORY_PASSWORD;
  if (!s) throw new Error("DIRECTORY_PASSWORD not configured");
  // Domain-separate from the directory cookie signer so a leaked
  // whatsapp invite token can never be replayed as a directory
  // session cookie (or vice versa).
  return `whatsapp-invite::${s}`;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** 30-day TTL: someone reading the email a week later still works. */
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function signWhatsappInviteToken(
  alumniId: number,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const payload: Payload = {
    aid: alumniId,
    exp: Date.now() + ttlSeconds * 1000,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, bytes as BufferSource);
  return `${b64url(bytes)}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyWhatsappInviteToken(
  token: string,
): Promise<{ alumniId: number } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let bytes: Uint8Array;
  let sig: Uint8Array;
  try {
    bytes = b64urlDecode(parts[0]);
    sig = b64urlDecode(parts[1]);
  } catch {
    return null;
  }
  const key = await hmacKey();
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sig as BufferSource,
    bytes as BufferSource,
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Payload;
    if (typeof payload.aid !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return { alumniId: payload.aid };
  } catch {
    return null;
  }
}
