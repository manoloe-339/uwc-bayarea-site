/**
 * Web-Crypto primitives used by the per-user directory auth path.
 * Everything here works in both Edge (middleware) and Node (route
 * handlers) — no Node-only crypto modules, no bcrypt/argon native
 * dependencies. PBKDF2 + SHA-256 is sufficient for a small-N user
 * system; we'd move to argon2 in a separate runtime if the user
 * count ever justified it.
 */

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH_BYTES = 32; // 256 bits

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

export function randomTokenBase64Url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

export async function sha256Base64Url(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return b64url(new Uint8Array(buf));
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    PBKDF2_KEY_LENGTH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export type HashedPassword = { hash: string; salt: string };

export async function hashPassword(password: string): Promise<HashedPassword> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const derived = await pbkdf2(password, saltBytes);
  return { hash: b64url(derived), salt: b64url(saltBytes) };
}

export async function verifyPassword(
  password: string,
  stored: HashedPassword | null,
): Promise<boolean> {
  if (!stored || !stored.hash || !stored.salt) return false;
  let saltBytes: Uint8Array;
  let storedBytes: Uint8Array;
  try {
    saltBytes = b64urlDecode(stored.salt);
    storedBytes = b64urlDecode(stored.hash);
  } catch {
    return false;
  }
  const derived = await pbkdf2(password, saltBytes);
  if (derived.length !== storedBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ storedBytes[i];
  return diff === 0;
}

/* ---------------- Cookie sign/verify ---------------- */

/** Cookie payload for a per-user directory session. The server reads
 * this on every request to find the user. session_version is verified
 * against the current row so revoking a user instantly breaks live
 * cookies (without per-request DB lookups for non-revoked users — we
 * only check the DB version when the cookie carries one). */
type CookiePayload = {
  uid: number;
  ver: number;
  exp: number;
};

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signUserCookie(
  payload: Omit<CookiePayload, "exp">,
  ttlSeconds: number,
  secret: string,
): Promise<string> {
  const full: CookiePayload = {
    ...payload,
    exp: Date.now() + ttlSeconds * 1000,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(full));
  const payloadB64 = b64url(payloadBytes);
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes as BufferSource);
  return `${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyUserCookie(
  cookie: string,
  secret: string,
): Promise<CookiePayload | null> {
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = b64urlDecode(parts[0]);
    sigBytes = b64urlDecode(parts[1]);
  } catch {
    return null;
  }
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    payloadBytes as BufferSource,
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as CookiePayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.uid !== "number" || typeof payload.ver !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}
