import { NextResponse } from "next/server";
import {
  DIRECTORY_COOKIE,
  DIRECTORY_TTL_SECONDS,
  signDirectoryCookie,
  timingSafeStringEqualDirectory,
} from "@/lib/directory-auth";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const expected = process.env.DIRECTORY_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Directory disabled: DIRECTORY_PASSWORD not set" },
      { status: 503 },
    );
  }

  let body: { password?: string; next?: string };
  try {
    body = (await req.json()) as { password?: string; next?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supplied = (body.password ?? "").trim();
  if (!supplied || !timingSafeStringEqualDirectory(supplied, expected)) {
    // 400ms delay to slow brute-force on the single shared credential.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await signDirectoryCookie(expected);
  const next =
    typeof body.next === "string" && body.next.startsWith("/directory")
      ? body.next
      : "/directory";
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
