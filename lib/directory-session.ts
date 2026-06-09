/**
 * Server-side guard helpers for the /directory surface.
 *
 * The middleware does a fast cookie-signature check (Edge runtime, no
 * DB). Each directory page calls getCurrentDirectorySession() which
 * does the full Node-runtime check: signature, TTL, AND a DB lookup
 * to confirm the user is still active and the session_version matches
 * (so revoking a user invalidates live cookies immediately on next
 * page load).
 */

import { cookies } from "next/headers";
import {
  DIRECTORY_COOKIE,
  hashSessionForAudit,
  verifyDirectoryCookie,
} from "./directory-auth";
import {
  signUserCookie,
  verifyUserCookie,
} from "./directory-crypto";
import {
  getDirectoryUserById,
  type DirectoryUserRow,
} from "./directory-users";

export const DIRECTORY_USER_COOKIE = "dir_user";
export const DIRECTORY_USER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function cookieSecret(): string {
  // We sign per-user cookies with a server secret derived from the
  // DIRECTORY_PASSWORD env. If the password is ever rotated, all live
  // per-user cookies invalidate too — acceptable since it's a rare
  // emergency action and a logged-in user can just sign in again.
  const s = process.env.DIRECTORY_PASSWORD;
  if (!s) throw new Error("DIRECTORY_PASSWORD not configured");
  return `dir-user::${s}`;
}

export async function signNewUserCookie(
  user: DirectoryUserRow,
): Promise<string> {
  return signUserCookie(
    { uid: user.id, ver: user.session_version },
    DIRECTORY_USER_TTL_SECONDS,
    cookieSecret(),
  );
}

/** A logged-in session — either a specific user (per-user account) or
 * an anonymous "shared password" session. Pages use this to decide
 * what to render (e.g., the saved-shortlist UI only appears for
 * per-user sessions). */
export type DirectorySession =
  | { kind: "user"; user: DirectoryUserRow; auditSessionId: string }
  | { kind: "shared"; auditSessionId: string };

export async function getCurrentDirectorySession(): Promise<DirectorySession | null> {
  const c = await cookies();

  // Prefer per-user cookie. If it's present and valid, use it.
  const userCookie = c.get(DIRECTORY_USER_COOKIE)?.value;
  if (userCookie) {
    try {
      const payload = await verifyUserCookie(userCookie, cookieSecret());
      if (payload) {
        const user = await getDirectoryUserById(payload.uid);
        if (user && user.status === "active" && user.session_version === payload.ver) {
          return {
            kind: "user",
            user,
            auditSessionId: `user:${user.id}`,
          };
        }
      }
    } catch {
      // Misconfiguration — fall through to shared check.
    }
  }

  // Fall back to shared password cookie.
  const sharedCookie = c.get(DIRECTORY_COOKIE)?.value;
  if (sharedCookie) {
    const expected = process.env.DIRECTORY_PASSWORD;
    if (expected && (await verifyDirectoryCookie(sharedCookie, expected))) {
      const hash = await hashSessionForAudit(sharedCookie);
      return { kind: "shared", auditSessionId: `shared:${hash}` };
    }
  }

  return null;
}
