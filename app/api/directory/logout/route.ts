import { NextResponse } from "next/server";
import { DIRECTORY_COOKIE } from "@/lib/directory-auth";
import { DIRECTORY_USER_COOKIE } from "@/lib/directory-session";

export const runtime = "nodejs";

/** Clears both directory cookies (per-user dir_user and shared
 * directory_session). Idempotent — fine to hit even if neither is
 * set. Returns ok so the client can redirect. */
export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  // maxAge:0 with the same path as the set instruction expires the
  // cookie. Both were set with path:'/' so we match.
  res.cookies.set(DIRECTORY_USER_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(DIRECTORY_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
