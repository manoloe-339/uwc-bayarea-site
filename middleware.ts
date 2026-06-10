import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/directory/:path*",
    "/api/directory/:path*",
  ],
};

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DIRECTORY_COOKIE_NAME = "directory_session";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Vercel Blob upload completion webhooks are POSTed to
  // /api/admin/event-photos/upload from Vercel's infrastructure (not the
  // user's browser), so they don't carry the admin Basic Auth header.
  // handleUpload() verifies the signed JWT body internally, so it's safe
  // to let any POST to this path through here. The route handler enforces
  // admin auth itself on the initial token-generation branch.
  if (
    req.method === "POST" &&
    path === "/api/admin/event-photos/upload"
  ) {
    return NextResponse.next();
  }

  /* ---------------- Directory (read-only) gate ---------------- */
  // Two parallel auth paths, checked here at the edge with cookie
  // signature verification only (DB checks happen in the page-level
  // guard so revoked users get caught on next page load).
  //   1. dir_user cookie — per-user account, signed payload {uid, ver, exp}
  //   2. directory_session cookie — shared DIRECTORY_PASSWORD fallback
  // Exempted paths are public so the user can actually sign in or set
  // their initial password via an invite token.
  if (path.startsWith("/directory") || path.startsWith("/api/directory")) {
    if (
      path === "/directory/login" ||
      path === "/api/directory/login" ||
      path === "/api/directory/login-pool" ||
      path === "/directory/setup" ||
      path === "/api/directory/setup"
    ) {
      const res = NextResponse.next();
      // Extra-strong cache-busting for the login page. Each visit
      // randomizes the backdrop tile pool; the dynamic-page default
      // already says no-store, but some browsers still serve from
      // bfcache or memory across quick reloads. Vary: * forces
      // revalidation on every request even when the URL is identical.
      if (path === "/directory/login") {
        res.headers.set(
          "Cache-Control",
          "private, no-store, no-cache, max-age=0, must-revalidate",
        );
        res.headers.set("Vary", "*");
        res.headers.set("Pragma", "no-cache");
        res.headers.set("Expires", "0");
      }
      return res;
    }
    const dirSecret = process.env.DIRECTORY_PASSWORD;
    if (!dirSecret) {
      return new NextResponse(
        "Directory disabled: DIRECTORY_PASSWORD not set",
        { status: 503 },
      );
    }
    // Per-user cookie signed with DIRECTORY_PASSWORD-derived key.
    const userCookie = req.cookies.get("dir_user")?.value;
    if (userCookie && (await verifyUserCookieEdge(userCookie, dirSecret))) {
      return NextResponse.next();
    }
    // Shared fallback cookie.
    const dirCookie = req.cookies.get(DIRECTORY_COOKIE_NAME)?.value;
    if (dirCookie && (await verifyCookie(dirCookie, dirSecret))) {
      return NextResponse.next();
    }
    // Not a browser navigation? Return 401 instead of redirect.
    if (path.startsWith("/api/directory")) {
      return new NextResponse("Directory authentication required", { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/directory/login";
    loginUrl.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
    return NextResponse.redirect(loginUrl);
  }

  /* ---------------- Admin gate (unchanged) ---------------- */
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

/** Verify the per-user dir_user cookie at the edge — signature + exp
 * only (the DB-backed session_version check is left to the page-level
 * guard so middleware stays Edge-safe and cheap). */
async function verifyUserCookieEdge(cookie: string, secret: string): Promise<boolean> {
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
  const key = await getHmacKey(`dir-user::${secret}`);
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
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
      exp?: number;
    };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
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
