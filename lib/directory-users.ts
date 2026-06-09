import { sql } from "./db";
import {
  hashPassword,
  randomTokenBase64Url,
  sha256Base64Url,
  verifyPassword,
} from "./directory-crypto";

export type DirectoryUserStatus = "invited" | "active" | "revoked";

export type DirectoryUserRow = {
  id: number;
  alumni_id: number | null;
  email: string;
  status: DirectoryUserStatus;
  password_hash: string | null;
  password_salt: string | null;
  session_version: number;
  invited_at: Date;
  activated_at: Date | null;
  last_seen_at: Date | null;
  revoked_at: Date | null;
};

export const INVITE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function getDirectoryUserById(
  id: number,
): Promise<DirectoryUserRow | null> {
  const rows = (await sql`
    SELECT * FROM directory_users WHERE id = ${id} LIMIT 1
  `) as DirectoryUserRow[];
  return rows[0] ?? null;
}

export async function getDirectoryUserByEmail(
  email: string,
): Promise<DirectoryUserRow | null> {
  const rows = (await sql`
    SELECT * FROM directory_users WHERE email = ${email.toLowerCase()} LIMIT 1
  `) as DirectoryUserRow[];
  return rows[0] ?? null;
}

export async function listDirectoryUsers(): Promise<DirectoryUserRow[]> {
  const rows = (await sql`
    SELECT * FROM directory_users
    ORDER BY (status = 'invited') DESC, last_seen_at DESC NULLS LAST, id DESC
    LIMIT 500
  `) as DirectoryUserRow[];
  return rows;
}

/** Insert a fresh invited-status row, or no-op if the email is already
 * present. Returns the resulting user row (existing or newly-created). */
export async function ensureDirectoryUser(args: {
  email: string;
  alumni_id: number | null;
}): Promise<DirectoryUserRow> {
  const email = args.email.trim().toLowerCase();
  const existing = await getDirectoryUserByEmail(email);
  if (existing) return existing;
  const rows = (await sql`
    INSERT INTO directory_users (alumni_id, email, status)
    VALUES (${args.alumni_id}, ${email}, 'invited')
    RETURNING *
  `) as DirectoryUserRow[];
  return rows[0];
}

/** Issue a single-use invite token tied to a user. The plaintext token
 * is returned only here — store its SHA-256 hash in the DB so a leak
 * of the table doesn't grant access. */
export async function issueInviteToken(
  directoryUserId: number,
): Promise<string> {
  const plain = randomTokenBase64Url(32);
  const hash = await sha256Base64Url(plain);
  const expires = new Date(Date.now() + INVITE_TOKEN_TTL_SECONDS * 1000);
  await sql`
    INSERT INTO directory_invite_tokens (token_hash, directory_user_id, expires_at)
    VALUES (${hash}, ${directoryUserId}, ${expires.toISOString()})
  `;
  return plain;
}

export type InviteTokenLookup =
  | { ok: true; user: DirectoryUserRow }
  | { ok: false; reason: "not_found" | "expired" | "used" | "revoked" };

/** Resolve a plaintext token to its user, validating expiry + single-use. */
export async function consumeInviteToken(
  plainToken: string,
): Promise<InviteTokenLookup> {
  if (!plainToken) return { ok: false, reason: "not_found" };
  const hash = await sha256Base64Url(plainToken);
  const rows = (await sql`
    SELECT t.token_hash, t.directory_user_id, t.expires_at, t.used_at
    FROM directory_invite_tokens t
    WHERE t.token_hash = ${hash}
    LIMIT 1
  `) as Array<{
    token_hash: string;
    directory_user_id: number;
    expires_at: Date;
    used_at: Date | null;
  }>;
  const row = rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.used_at) return { ok: false, reason: "used" };
  const exp =
    row.expires_at instanceof Date
      ? row.expires_at.getTime()
      : new Date(row.expires_at).getTime();
  if (Number.isFinite(exp) && exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  const user = await getDirectoryUserById(row.directory_user_id);
  if (!user) return { ok: false, reason: "not_found" };
  if (user.status === "revoked") return { ok: false, reason: "revoked" };
  return { ok: true, user };
}

/** Mark a token as used (we look it up by hash again here so the
 * caller doesn't have to pass it around). */
async function markTokenUsed(plainToken: string): Promise<void> {
  const hash = await sha256Base64Url(plainToken);
  await sql`
    UPDATE directory_invite_tokens
    SET used_at = NOW()
    WHERE token_hash = ${hash}
  `;
}

/** Set a user's password (turns the row from 'invited' to 'active' the
 * first time around), mark the invite token used, return the row. */
export async function setUserPassword(
  plainToken: string,
  newPassword: string,
): Promise<DirectoryUserRow | null> {
  const lookup = await consumeInviteToken(plainToken);
  if (!lookup.ok) return null;
  const { hash, salt } = await hashPassword(newPassword);
  const rows = (await sql`
    UPDATE directory_users
    SET password_hash = ${hash},
        password_salt = ${salt},
        status = 'active',
        activated_at = COALESCE(activated_at, NOW())
    WHERE id = ${lookup.user.id}
    RETURNING *
  `) as DirectoryUserRow[];
  await markTokenUsed(plainToken);
  return rows[0] ?? null;
}

export async function authenticateDirectoryUser(
  email: string,
  password: string,
): Promise<DirectoryUserRow | null> {
  const user = await getDirectoryUserByEmail(email);
  if (!user || user.status !== "active") return null;
  const ok = await verifyPassword(password, {
    hash: user.password_hash ?? "",
    salt: user.password_salt ?? "",
  });
  if (!ok) return null;
  await sql`
    UPDATE directory_users SET last_seen_at = NOW() WHERE id = ${user.id}
  `;
  return user;
}

export async function touchLastSeen(userId: number): Promise<void> {
  await sql`
    UPDATE directory_users SET last_seen_at = NOW() WHERE id = ${userId}
  `;
}

export async function revokeDirectoryUser(id: number): Promise<void> {
  await sql`
    UPDATE directory_users
    SET status = 'revoked',
        revoked_at = NOW(),
        session_version = session_version + 1
    WHERE id = ${id}
  `;
}

export async function unrevokeDirectoryUser(id: number): Promise<void> {
  // Move back to invited so a fresh invite token can re-activate them.
  // session_version is NOT decremented; their prior cookies stay dead.
  await sql`
    UPDATE directory_users
    SET status = 'invited',
        revoked_at = NULL
    WHERE id = ${id}
  `;
}

/* ---------------- Per-user activity summary ---------------- */

export type UserActivitySummary = {
  user_id: number;
  search_count: number;
  view_count: number;
  saved_count: number;
  saves_invite_sent_24h: number; // for abuse flagging
  saves_24h: number;
  views_1h: number;
  searches_1h: number;
};

export async function getActivitySummaries(): Promise<UserActivitySummary[]> {
  // Single query that aggregates everything we need so the admin tool
  // can render with one DB round-trip.
  const rows = (await sql`
    SELECT u.id AS user_id,
           COALESCE(SUM(CASE WHEN v.action = 'search' THEN 1 ELSE 0 END), 0)::int AS search_count,
           COALESCE(SUM(CASE WHEN v.action = 'profile_view' THEN 1 ELSE 0 END), 0)::int AS view_count,
           COALESCE(SUM(CASE WHEN v.action = 'search' AND v.at > NOW() - INTERVAL '1 hour' THEN 1 ELSE 0 END), 0)::int AS searches_1h,
           COALESCE(SUM(CASE WHEN v.action = 'profile_view' AND v.at > NOW() - INTERVAL '1 hour' THEN 1 ELSE 0 END), 0)::int AS views_1h,
           (SELECT COUNT(*)::int FROM directory_saves s WHERE s.directory_user_id = u.id) AS saved_count,
           (SELECT COUNT(*)::int FROM directory_saves s WHERE s.directory_user_id = u.id AND s.updated_at > NOW() - INTERVAL '24 hours') AS saves_24h,
           (SELECT COUNT(*)::int FROM directory_saves s WHERE s.directory_user_id = u.id AND s.status = 'invite_sent' AND s.updated_at > NOW() - INTERVAL '24 hours') AS saves_invite_sent_24h
    FROM directory_users u
    LEFT JOIN directory_views v ON v.directory_user_id = u.id
    GROUP BY u.id
  `) as UserActivitySummary[];
  return rows;
}

/* ---------------- Abuse flags ---------------- */

export const ABUSE_THRESHOLDS = {
  SAVES_24H: 30,
  SAVES_INVITE_SENT_24H: 20,
  VIEWS_1H: 100,
  SEARCHES_1H: 50,
} as const;

export type AbuseFlag =
  | "bulk_saving"
  | "bulk_invite_sent"
  | "heavy_views"
  | "heavy_searching";

export const ABUSE_FLAG_LABELS: Record<AbuseFlag, string> = {
  bulk_saving: "Bulk saving",
  bulk_invite_sent: "Bulk invites marked sent",
  heavy_views: "Heavy profile views",
  heavy_searching: "Heavy searching",
};

export function computeAbuseFlags(summary: UserActivitySummary): AbuseFlag[] {
  const flags: AbuseFlag[] = [];
  if (summary.saves_24h > ABUSE_THRESHOLDS.SAVES_24H) flags.push("bulk_saving");
  if (summary.saves_invite_sent_24h > ABUSE_THRESHOLDS.SAVES_INVITE_SENT_24H)
    flags.push("bulk_invite_sent");
  if (summary.views_1h > ABUSE_THRESHOLDS.VIEWS_1H) flags.push("heavy_views");
  if (summary.searches_1h > ABUSE_THRESHOLDS.SEARCHES_1H)
    flags.push("heavy_searching");
  return flags;
}

/** Total count of users currently tripping at least one abuse flag.
 * Used by the /admin/tools index to surface a "needs attention" hint. */
export async function countFlaggedUsers(): Promise<number> {
  const summaries = await getActivitySummaries();
  return summaries.filter((s) => computeAbuseFlags(s).length > 0).length;
}

/* ---------------- Recent activity for drill-down ---------------- */

export type RecentActivityRow = {
  at: Date;
  action: "search" | "profile_view";
  target_id: number | null;
  target_name: string | null;
  query_json: unknown;
};

export async function getRecentActivity(
  userId: number,
  limit = 50,
): Promise<RecentActivityRow[]> {
  const rows = (await sql`
    SELECT v.at, v.action, v.target_id, v.query_json,
           CASE
             WHEN v.target_id IS NOT NULL
               THEN COALESCE(NULLIF(TRIM(CONCAT(a.first_name, ' ', a.last_name)), ''), '(no name)')
             ELSE NULL
           END AS target_name
    FROM directory_views v
    LEFT JOIN alumni a ON a.id = v.target_id
    WHERE v.directory_user_id = ${userId}
    ORDER BY v.at DESC
    LIMIT ${limit}
  `) as RecentActivityRow[];
  return rows;
}
