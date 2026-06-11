/**
 * Email template for the directory-invite. Lives in its own (non-
 * "use server") file so the admin page can import the subject /
 * body / URL pattern for the email preview — Next.js doesn't allow
 * non-function exports from "use server" modules.
 */

export const DIRECTORY_INVITE_SUBJECT = "Your UWC Bay Area Directory invite";

/** Canonical invite URL pattern. Token gets appended at send time. */
export const DIRECTORY_INVITE_BASE_URL =
  "https://uwcbayarea.org/directory/setup";

/** Builds the plaintext body of the invite email. Each paragraph is
 * a single line — the email renderer wraps naturally so we don't
 * break mid-sentence; blank lines become spacers. */
export function buildDirectoryInviteBody(inviteUrl: string): string {
  return [
    `You've been invited to the UWC Bay Area Directory beta — a read-only lookup of registered alumni for finding connections on LinkedIn. The directory is contact-info-free by design: you see names, photos, roles, and LinkedIn links, but never email or phone numbers.`,
    ``,
    `A few things to know before you sign in:`,
    ``,
    `• This invite is personal and not transferable. Please don't share or forward it — we log activity per account, and transferred or shared access will be revoked.`,
    ``,
    `• It's not a tool for bulk LinkedIn outreach. Sending invites to dozens of alumni at once will get your access suspended. Reach out one connection at a time, where there's a real reason.`,
    ``,
    `• It's a beta. Every directory page has a "Feedback" link in the header — please use it to flag anything broken, weird, or worth improving.`,
    ``,
    `Click the link below to set your password and start using it:`,
    ``,
    inviteUrl,
    ``,
    `The link is single-use and expires in 7 days. If it doesn't work or expires, just reply to this email and I'll resend.`,
    ``,
    `— Manolo`,
  ].join("\n");
}
