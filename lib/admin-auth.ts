/**
 * Shared admin-session cookie helpers used by both `middleware.ts` (Edge
 * runtime) and any API routes that need to authenticate admin requests
 * outside of the middleware path — e.g. Vercel Blob's
 * `onBeforeGenerateToken` callback runs inside the route handler, after
 * middleware has been bypassed for the route's own auth, so the route
 * has to verify the admin_session cookie itself.
 *
 * Everything here uses Web Crypto (`crypto.subtle`) + btoa/atob so the
 * module works identically in Edge and Node runtimes.
 */

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

export async function signAdminCookie(secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const exp = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
  const payloadBytes = new TextEncoder().encode(JSON.stringify({ exp }));
  const payloadB64 = b64url(payloadBytes);
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes as BufferSource);
  return `${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyAdminCookie(
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

/** Constant-time string equality for Basic Auth password comparison. */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/** Verify an incoming request is an authenticated admin. Accepts either
 * a valid admin_session cookie OR a Basic Auth header matching
 * ADMIN_PASSWORD. Used by API route handlers that need to enforce admin
 * auth outside the middleware (e.g. Vercel Blob token generation). */
export async function isAuthenticatedAdmin(request: Request): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;

  // Cookie path — what the admin gets after first login.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.slice(ADMIN_SESSION_COOKIE.length + 1);
  if (cookieValue && (await verifyAdminCookie(cookieValue, expected))) {
    return true;
  }

  // Basic Auth fallback — first request before the cookie is set, or
  // tools/curl-style admin calls.
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Basic ")) {
    try {
      const decoded = atob(authHeader.slice(6));
      const idx = decoded.indexOf(":");
      const pass = idx >= 0 ? decoded.slice(idx + 1) : decoded;
      if (timingSafeStringEqual(pass, expected)) return true;
    } catch {
      // fall through
    }
  }

  return false;
}
