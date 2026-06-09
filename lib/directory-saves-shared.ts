/**
 * Constants + types for directory_saves that are SAFE for client
 * components to import. The full data-layer (lib/directory-saves.ts)
 * imports the SQL client, so dragging it into a "use client" file
 * crashes at runtime with "DATABASE_URL is not set" because the bundler
 * pulls all transitive imports into the browser bundle.
 *
 * Anything client components need (constants, labels, types, regex
 * helpers) lives here. Server-only functions live in directory-saves.ts.
 */

export const SAVE_STATUSES = [
  "not_contacted",
  "invite_sent",
  "connected",
  "replied",
  "met",
  "follow_up_later",
  "closed",
] as const;
export type SaveStatus = (typeof SAVE_STATUSES)[number];

export const SAVE_REASONS = [
  "meet",
  "job",
  "referral",
  "mentor",
  "founder",
  "industry",
  "other",
] as const;
export type SaveReason = (typeof SAVE_REASONS)[number];

export const STATUS_LABELS: Record<SaveStatus, string> = {
  not_contacted: "Not contacted",
  invite_sent: "Invite sent",
  connected: "Connected",
  replied: "Replied",
  met: "Met",
  follow_up_later: "Follow up later",
  closed: "Closed",
};

export const REASON_LABELS: Record<SaveReason, string> = {
  meet: "Want to meet!",
  job: "Job opportunity",
  referral: "Referral / intro",
  mentor: "Mentorship",
  founder: "Founder / peer",
  industry: "Industry interest",
  other: "Other",
};

export const MAX_NOTE_CHARS = 300;

export function isSaveStatus(v: string): v is SaveStatus {
  return (SAVE_STATUSES as readonly string[]).includes(v);
}
export function isSaveReason(v: string): v is SaveReason {
  return (SAVE_REASONS as readonly string[]).includes(v);
}
