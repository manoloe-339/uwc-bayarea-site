import { NextResponse } from "next/server";
import {
  getDirectoryUserByEmail,
  issueInviteToken,
} from "@/lib/directory-users";
import { sendTestEmail } from "@/lib/email-send";
import {
  DIRECTORY_INVITE_BASE_URL,
} from "@/app/admin/tools/directory-users/invite-template";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Self-serve password reset: a directory user enters their email →
 * if it matches an existing account, we issue a fresh setup-style
 * token and email them a link. The link lands on /directory/setup
 * which already handles the token flow — single code path for both
 * first-time invite and password reset.
 *
 * Response is always 200 (with `ok: true`) regardless of whether
 * the email exists, so this endpoint can't be used to enumerate
 * accounts. The actual email send is silently skipped for
 * non-existent / revoked accounts.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Enter a valid email." },
      { status: 400 },
    );
  }

  const user = await getDirectoryUserByEmail(email);
  // We always return success — but only actually send if the user
  // exists and isn't revoked.
  if (user && user.status !== "revoked") {
    const token = await issueInviteToken(user.id);
    // Look up the alum's first name for the email greeting.
    const rows = (await sql`
      SELECT a.first_name
      FROM directory_users u
      LEFT JOIN alumni a ON a.id = u.alumni_id
      WHERE u.id = ${user.id} LIMIT 1
    `) as Array<{ first_name: string | null }>;
    const firstName = rows[0]?.first_name?.trim().split(/\s+/)[0] ?? null;
    const resetUrl = `${DIRECTORY_INVITE_BASE_URL}?token=${token}`;
    const body = [
      `You asked to reset your UWC Bay Area Directory password.`,
      ``,
      `Click the link below to set a new one — the link is single-use and expires in 7 days:`,
      ``,
      resetUrl,
      ``,
      `If you didn't request this, you can ignore this email; the link won't be used and your existing password still works.`,
      ``,
      `— Manolo`,
    ].join("\n");
    await sendTestEmail({
      to: email,
      subject: "Reset your UWC Bay Area Directory password",
      body,
      salutation: "Hi",
      includeFirstName: !!firstName,
      firstName: firstName ?? undefined,
    }).then((r) => {
      if (!r.ok) {
        console.warn(`[directory-forgot] send failed: ${r.error}`);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
