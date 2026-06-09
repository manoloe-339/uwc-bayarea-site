"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ensureDirectoryUser,
  issueInviteToken,
  revokeDirectoryUser,
  unrevokeDirectoryUser,
} from "@/lib/directory-users";
import { sendTestEmail } from "@/lib/email-send";

const TOOL_PATH = "/admin/tools/directory-users";

async function sendInviteEmail(args: {
  email: string;
  firstName: string | null;
  inviteUrl: string;
}): Promise<void> {
  const body = [
    `You've been invited to the UWC Bay Area Directory beta — a read-only`,
    `lookup of registered alumni for finding connections on LinkedIn. The`,
    `directory is contact-info-free by design: you see names, photos,`,
    `roles, and LinkedIn links, but never email or phone numbers.`,
    ``,
    `Click the link below to set your password and start using it:`,
    ``,
    args.inviteUrl,
    ``,
    `The link is single-use and expires in 7 days. If it doesn't work or`,
    `expires, just reply to this email and I'll resend.`,
    ``,
    `— Manolo`,
  ].join("\n");

  await sendTestEmail({
    to: args.email,
    subject: "Your UWC Bay Area Directory invite",
    body,
    salutation: "Hi",
    includeFirstName: !!args.firstName,
    firstName: args.firstName ?? undefined,
  }).then((r) => {
    if (!r.ok) console.warn(`[directory-invite] send failed: ${r.error}`);
  });
}

export async function inviteDirectoryUserAction(
  formData: FormData,
): Promise<void> {
  const alumniIdRaw = formData.get("alumni_id");
  const emailOverride = String(formData.get("email") ?? "").trim();
  const alumniId = Number(alumniIdRaw);
  if (!Number.isFinite(alumniId) || alumniId <= 0) {
    redirect(`${TOOL_PATH}?msg=${encodeURIComponent("Pick an alum first.")}`);
  }

  const { sql } = await import("@/lib/db");
  const rows = (await sql`
    SELECT id, first_name, email
    FROM alumni
    WHERE id = ${alumniId} AND deceased IS NOT TRUE
    LIMIT 1
  `) as Array<{ id: number; first_name: string | null; email: string | null }>;
  const alum = rows[0];
  if (!alum) {
    redirect(`${TOOL_PATH}?msg=${encodeURIComponent("Alum not found.")}`);
  }
  const targetEmail = (emailOverride || alum.email || "").trim().toLowerCase();
  if (!targetEmail) {
    redirect(
      `${TOOL_PATH}?msg=${encodeURIComponent("No email on file; enter one to override.")}`,
    );
  }

  const user = await ensureDirectoryUser({
    email: targetEmail,
    alumni_id: alum.id,
  });
  const token = await issueInviteToken(user.id);
  const inviteUrl = `https://uwcbayarea.org/directory/setup?token=${token}`;
  await sendInviteEmail({
    email: targetEmail,
    firstName: alum.first_name,
    inviteUrl,
  });
  revalidatePath(TOOL_PATH);
  revalidatePath("/admin/tools");
  redirect(
    `${TOOL_PATH}?msg=${encodeURIComponent(`Invite sent to ${targetEmail}.`)}`,
  );
}

export async function resendInviteAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("user_id"));
  if (!Number.isFinite(userId) || userId <= 0) return;
  const { sql } = await import("@/lib/db");
  const rows = (await sql`
    SELECT u.email, a.first_name
    FROM directory_users u
    LEFT JOIN alumni a ON a.id = u.alumni_id
    WHERE u.id = ${userId} LIMIT 1
  `) as Array<{ email: string; first_name: string | null }>;
  const row = rows[0];
  if (!row) return;
  const token = await issueInviteToken(userId);
  const inviteUrl = `https://uwcbayarea.org/directory/setup?token=${token}`;
  await sendInviteEmail({
    email: row.email,
    firstName: row.first_name,
    inviteUrl,
  });
  revalidatePath(TOOL_PATH);
  redirect(`${TOOL_PATH}?msg=${encodeURIComponent("Invite resent.")}`);
}

export async function revokeDirectoryUserAction(
  formData: FormData,
): Promise<void> {
  const id = Number(formData.get("user_id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await revokeDirectoryUser(id);
  revalidatePath(TOOL_PATH);
  revalidatePath("/admin/tools");
}

export async function unrevokeDirectoryUserAction(
  formData: FormData,
): Promise<void> {
  const id = Number(formData.get("user_id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await unrevokeDirectoryUser(id);
  revalidatePath(TOOL_PATH);
}
