import { NextResponse } from "next/server";
import {
  DIRECTORY_COOKIE,
  DIRECTORY_TTL_SECONDS,
  signDirectoryCookie,
  timingSafeStringEqualDirectory,
} from "@/lib/directory-auth";
import {
  DIRECTORY_USER_COOKIE,
  DIRECTORY_USER_TTL_SECONDS,
  signNewUserCookie,
} from "@/lib/directory-session";
import { authenticateDirectoryUser } from "@/lib/directory-users";

export const runtime = "nodejs";

/** Login handles both per-user (email + password) and the shared
 * fallback (password only — matched against DIRECTORY_PASSWORD). The
 * client form sends both fields; we route by what's present and what
 * matches. */
export async function POST(req: Request): Promise<NextResponse> {
  const shared = process.env.DIRECTORY_PASSWORD;
  if (!shared) {
    return NextResponse.json(
      { error: "Directory disabled: DIRECTORY_PASSWORD not set" },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string; next?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string; next?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = (body.password ?? "").trim();
  const next =
    typeof body.next === "string" && body.next.startsWith("/directory")
      ? body.next
      : "/directory";

  if (!password) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  // Per-user path: email + password.
  if (email) {
    const user = await authenticateDirectoryUser(email, password);
    if (user) {
      const token = await signNewUserCookie(user);
      const res = NextResponse.json({ ok: true, next });
      res.cookies.set(DIRECTORY_USER_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: DIRECTORY_USER_TTL_SECONDS,
      });
      return res;
    }
    // Per-user failed — fall through and try shared password.
  }

  // Shared fallback path: password matches DIRECTORY_PASSWORD.
  if (timingSafeStringEqualDirectory(password, shared)) {
    const token = await signDirectoryCookie(shared);
    const res = NextResponse.json({ ok: true, next });
    res.cookies.set(DIRECTORY_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: DIRECTORY_TTL_SECONDS,
    });
    return res;
  }

  // Slow-down to make brute force less ergonomic.
  await new Promise((r) => setTimeout(r, 400));
  return NextResponse.json(
    { error: email ? "Email or password is incorrect." : "Incorrect password." },
    { status: 401 },
  );
}
