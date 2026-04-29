import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export function middleware(req: NextRequest) {
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

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const idx = decoded.indexOf(":");
      const pass = idx >= 0 ? decoded.slice(idx + 1) : decoded;
      if (timingSafeEqual(pass, expected)) {
        return NextResponse.next();
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
