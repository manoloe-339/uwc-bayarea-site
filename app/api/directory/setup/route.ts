import { NextResponse } from "next/server";
import {
  consumeInviteToken,
  setUserPassword,
} from "@/lib/directory-users";
import {
  DIRECTORY_USER_COOKIE,
  DIRECTORY_USER_TTL_SECONDS,
  signNewUserCookie,
} from "@/lib/directory-session";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

/** Token-bearing endpoint: invitee redeems their email link and sets
 * a password. On success: row → 'active', cookie issued, token marked
 * used so it can't be replayed. */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { token?: string; password?: string; tos_accepted?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const password = (body.password ?? "").trim();

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  // Validate up-front (so we can return a useful error before we hash).
  const lookup = await consumeInviteToken(token);
  if (!lookup.ok) {
    const messages: Record<string, string> = {
      not_found: "This invite link is invalid.",
      expired: "This invite has expired. Ask the admin to resend.",
      used: "This invite has already been used. Sign in normally.",
      revoked: "This account has been revoked.",
    };
    return NextResponse.json(
      { error: messages[lookup.reason] ?? "Invite not usable." },
      { status: 400 },
    );
  }

  const user = await setUserPassword(token, password);
  if (!user) {
    return NextResponse.json(
      { error: "Could not set password — try the invite link again." },
      { status: 400 },
    );
  }

  // Record TOS acceptance if the client confirmed it. The setup form
  // ships true; older callers without the field fall through with no
  // recorded acceptance — admin can spot those by querying
  // `directory_users WHERE tos_accepted_at IS NULL`.
  if (body.tos_accepted === true) {
    const { sql } = await import("@/lib/db");
    await sql`
      UPDATE directory_users SET tos_accepted_at = NOW()
      WHERE id = ${user.id} AND tos_accepted_at IS NULL
    `;
  }

  const cookieValue = await signNewUserCookie(user);
  const res = NextResponse.json({ ok: true, next: "/directory" });
  res.cookies.set(DIRECTORY_USER_COOKIE, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DIRECTORY_USER_TTL_SECONDS,
  });
  return res;
}
