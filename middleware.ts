import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function middleware(req: NextRequest) {
  // Vercel Blob upload completion webhooks are POSTed to
  // /api/admin/event-photos/upload from Vercel's infrastructure (not the
  // user's browser), so they don't carry the admin Basic Auth header.
  // handleUpload() verifies the signed JWT body internally, so it's safe
  // to let any POST to this path through here. The route handler enforces
  // admin auth itself on the initial token-generation branch.
  if (
    req.method === "POST" &&
    req.nextUrl.pathname === "/api/admin/event-photos/upload"
  ) {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new NextResponse("Admin disabled: ADMIN_PASSWORD not set", { status: 503 });
  }

  // Existing session cookie? Skip the Basic-auth prompt entirely.
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie && (await verifyCookie(cookie, expected))) {
    return NextResponse.next();
  }

  // Fall back to Basic auth. On success, issue a session cookie so
  // subsequent admin requests skip this prompt for 30 days.
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const idx = decoded.indexOf(":");
      const pass = idx >= 0 ? decoded.slice(idx + 1) : decoded;
      if (timingSafeEqual(pass, expected)) {
        const res = NextResponse.next();
        const value = await signCookie(expected);
        res.cookies.set({
          name: COOKIE_NAME,
          value,
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: COOKIE_MAX_AGE_SECONDS,
        });
        return res;
      }
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="UWC admin", charset="UTF-8"',
    },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/* ------------------------------------------------------------------ */
/* Session cookie helpers — HMAC-signed payload using ADMIN_PASSWORD  */
/* as the key. Payload encodes only an exp timestamp. Web Crypto so   */
/* the same code works in Edge and Node middleware runtimes.          */
/* ------------------------------------------------------------------ */

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

async function signCookie(secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const exp = Date.now() + COOKIE_MAX_AGE_SECONDS * 1000;
  const payloadBytes = new TextEncoder().encode(JSON.stringify({ exp }));
  const payloadB64 = b64url(payloadBytes);
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes as BufferSource);
  return `${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

async function verifyCookie(cookie: string, secret: string): Promise<boolean> {
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
