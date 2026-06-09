/**
 * Read-only directory auth — separate from admin auth so the directory
 * credential can never be confused for an admin credential, even by a
 * bug. Cookie name is distinct; HMAC key is distinct (uses
 * DIRECTORY_PASSWORD itself for self-rotation on password change).
 *
 * Mirrors lib/admin-auth.ts in shape but is intentionally NOT shared —
 * the symmetry is just for readability.
 */

export const DIRECTORY_COOKIE = "directory_session";
export const DIRECTORY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signDirectoryCookie(secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const exp = Date.now() + DIRECTORY_TTL_SECONDS * 1000;
  const payloadBytes = new TextEncoder().encode(JSON.stringify({ exp }));
  const payloadB64 = b64url(payloadBytes);
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes as BufferSource);
  return `${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyDirectoryCookie(
  cookie: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!cookie) return false;
  const parts = cookie.split(".");
  if (parts.length !== 2) return false;
  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = b64urlDecode(parts[0]);
    sigBytes = b64urlDecode(parts[1]);
  } catch {
    return false;
  }
  const key = await getHmacKey(secret);
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as BufferSource,
      payloadBytes as BufferSource,
    );
  } catch {
    return false;
  }
  if (!valid) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

/** Stable hash of a session cookie for audit logging. We never want to
 * store raw cookie values; the hash is enough to correlate a user's
 * actions across requests without it being a credential. */
export async function hashSessionForAudit(cookie: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(cookie),
  );
  return b64url(new Uint8Array(buf)).slice(0, 16);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/** Cookie-only check used by the directory pages. Does NOT fall back
 * to admin password — the directory has its own credential by design. */
export async function isAuthenticatedDirectory(
  cookieValue: string | undefined,
): Promise<boolean> {
  const expected = process.env.DIRECTORY_PASSWORD;
  if (!expected) return false;
  return verifyDirectoryCookie(cookieValue, expected);
}

export { timingSafeStringEqual as timingSafeStringEqualDirectory };
