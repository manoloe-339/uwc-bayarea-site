import Link from "next/link";
import {
  computeAbuseFlags,
  getActivitySummaries,
  listDirectoryUsers,
  ABUSE_FLAG_LABELS,
} from "@/lib/directory-users";
import {
  inviteDirectoryUserAction,
  resendInviteAction,
  revokeDirectoryUserAction,
  unrevokeDirectoryUserAction,
} from "./actions";
import {
  DIRECTORY_INVITE_BASE_URL,
  DIRECTORY_INVITE_SUBJECT,
  buildDirectoryInviteBody,
} from "./invite-template";
import InvitePicker from "./InvitePicker";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(dd.getTime())) return "—";
  return dd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtRel(d: Date | null): string {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(String(d));
  const diff = Date.now() - dd.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  return `${d2}d ago`;
}

export default async function DirectoryUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const sp = await searchParams;
  const msg = sp.msg ?? null;

  const [users, summaries] = await Promise.all([
    listDirectoryUsers(),
    getActivitySummaries(),
  ]);
  const summaryById = new Map(summaries.map((s) => [s.user_id, s]));

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools" className="text-[color:var(--muted)] hover:text-navy">
          ← Tools
        </Link>
      </div>
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">
          Directory users
        </h1>
        <Link
          href="/admin/tools/directory-users/activity"
          className="text-sm text-navy hover:underline whitespace-nowrap"
        >
          📜 Activity log →
        </Link>
      </div>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Invite-only access to /directory. Each user gets their own
        password; you can revoke any of them. The shared{" "}
        <code className="font-mono text-[11px]">DIRECTORY_PASSWORD</code>{" "}
        stays as an emergency fallback — its sessions show up tagged
        &ldquo;shared&rdquo; in the activity log.
      </p>

      {msg && (
        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
          {msg}
        </div>
      )}

      <details className="mb-6 bg-white border border-[color:var(--rule)] rounded-[10px] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-navy">
          + Invite a new user
        </summary>
        <form action={inviteDirectoryUserAction} className="mt-3 space-y-3">
          <InvitePicker />
          <label className="block">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
              Email override (optional)
            </span>
            <input
              name="email"
              type="email"
              placeholder="Leave blank to use the alum's existing email"
              className="w-full sm:w-[360px] border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
          <button
            type="submit"
            className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold hover:opacity-90"
          >
            Send invite
          </button>
        </form>

        {/* Preview of the actual email body. Token shown as a
            placeholder; the real send fills it in. */}
        <details className="mt-4 border-t border-[color:var(--rule)] pt-4">
          <summary className="cursor-pointer text-xs text-[color:var(--muted)] hover:text-navy">
            Preview the email body
          </summary>
          <div className="mt-3 text-xs">
            <div className="mb-2">
              <span className="font-bold text-navy uppercase tracking-[.18em] text-[10px]">
                Subject
              </span>
              <div className="font-mono mt-1 text-[color:var(--navy-ink)]">
                {DIRECTORY_INVITE_SUBJECT}
              </div>
            </div>
            <div className="mb-2">
              <span className="font-bold text-navy uppercase tracking-[.18em] text-[10px]">
                Salutation
              </span>
              <div className="font-mono mt-1 text-[color:var(--navy-ink)]">
                Hi [first name],
              </div>
            </div>
            <div>
              <span className="font-bold text-navy uppercase tracking-[.18em] text-[10px]">
                Body
              </span>
              <pre className="font-mono mt-1 text-[color:var(--navy-ink)] whitespace-pre-wrap leading-relaxed">
                {buildDirectoryInviteBody(
                  `${DIRECTORY_INVITE_BASE_URL}?token=<UNIQUE_TOKEN_PER_USER>`,
                )}
              </pre>
            </div>
          </div>
        </details>
      </details>

      {users.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
          No directory users yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => {
            const summary = summaryById.get(u.id);
            const flags = summary ? computeAbuseFlags(summary) : [];
            return (
              <li
                key={u.id}
                className={`bg-white border rounded-[10px] p-4 ${
                  flags.length > 0
                    ? "border-rose-300"
                    : u.status === "revoked"
                      ? "border-dashed border-[color:var(--rule)] opacity-70"
                      : "border-[color:var(--rule)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/tools/directory-users/${u.id}`}
                        className="font-semibold text-[color:var(--navy-ink)] hover:underline"
                      >
                        {u.email}
                      </Link>
                      <span
                        className={`text-[10px] tracking-[.18em] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          u.status === "active"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : u.status === "invited"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-stone-100 text-stone-700 border-stone-200"
                        }`}
                      >
                        {u.status}
                      </span>
                      {flags.length > 0 && (
                        <span
                          className="text-[10px] tracking-[.18em] uppercase font-bold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-800 border-rose-200"
                          title={flags.map((f) => ABUSE_FLAG_LABELS[f]).join(" · ")}
                        >
                          🚩 {flags.length} flag{flags.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[color:var(--muted)] mt-1">
                      Invited {fmtDate(u.invited_at)}
                      {u.last_seen_at ? ` · Last seen ${fmtRel(u.last_seen_at)}` : ""}
                      {u.alumni_id && (
                        <>
                          {" · "}
                          <Link
                            href={`/admin/alumni/${u.alumni_id}`}
                            className="text-navy hover:underline"
                          >
                            Alum record
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-[color:var(--muted)] mt-1">
                      Searches {summary?.search_count ?? 0} ·
                      Views {summary?.view_count ?? 0} ·
                      Saved {summary?.saved_count ?? 0}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {u.status === "invited" && (
                      <form action={resendInviteAction}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-navy hover:underline"
                        >
                          Resend invite
                        </button>
                      </form>
                    )}
                    {u.status === "active" && (
                      <form action={revokeDirectoryUserAction}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <button
                          type="submit"
                          className="text-xs text-rose-700 hover:underline"
                        >
                          Revoke
                        </button>
                      </form>
                    )}
                    {u.status === "revoked" && (
                      <form action={unrevokeDirectoryUserAction}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-navy hover:underline"
                        >
                          Re-invite
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
