import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDirectoryUserById,
  getRecentActivity,
} from "@/lib/directory-users";

export const dynamic = "force-dynamic";

function fmtTs(d: Date): string {
  const dd = d instanceof Date ? d : new Date(String(d));
  return dd.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DirectoryUserActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) notFound();
  const user = await getDirectoryUserById(id);
  if (!user) notFound();

  const activity = await getRecentActivity(id, 100);

  return (
    <div className="max-w-[900px]">
      <div className="mb-4 text-sm">
        <Link
          href="/admin/tools/directory-users"
          className="text-[color:var(--muted)] hover:text-navy"
        >
          ← Directory users
        </Link>
      </div>
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-1">
        {user.email}
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-7">
        Status: <strong>{user.status}</strong>
        {user.last_seen_at && ` · Last seen ${new Date(user.last_seen_at).toLocaleString()}`}
      </p>

      <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
        Recent activity ({activity.length})
      </h2>

      {activity.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-8 text-center text-[color:var(--muted)] text-sm">
          No directory activity yet.
        </div>
      ) : (
        <ul className="bg-white border border-[color:var(--rule)] rounded-[10px] divide-y divide-[color:var(--rule)]">
          {activity.map((row, i) => {
            const where = [row.city, row.region, row.country].filter(Boolean).join(", ");
            return (
            <li key={i} className="p-3 text-sm flex items-start gap-3">
              <span className="text-[11px] text-[color:var(--muted)] font-mono shrink-0 w-[110px]">
                {fmtTs(row.at)}
              </span>
              <span
                className="text-[11px] text-[color:var(--muted)] shrink-0 w-[140px] truncate"
                title={row.user_agent ?? undefined}
              >
                {where || "—"}
              </span>
              <span className="flex-1 min-w-0">
                {row.action === "profile_view" ? (
                  <>
                    Viewed{" "}
                    <Link
                      href={`/admin/alumni/${row.target_id}`}
                      className="text-navy hover:underline"
                    >
                      {row.target_name ?? `#${row.target_id}`}
                    </Link>
                  </>
                ) : row.action === "linkedin_click" ? (
                  <>
                    <span className="font-semibold text-[#0A66C2]">
                      Clicked LinkedIn →
                    </span>{" "}
                    <Link
                      href={`/admin/alumni/${row.target_id}`}
                      className="text-navy hover:underline"
                    >
                      {row.target_name ?? `#${row.target_id}`}
                    </Link>
                  </>
                ) : (
                  <>
                    Searched{" "}
                    {row.query_json ? (
                      <code className="text-[11px] bg-[color:var(--ivory-2)] px-1 py-0.5 rounded">
                        {JSON.stringify(row.query_json)}
                      </code>
                    ) : (
                      "(no filters)"
                    )}
                  </>
                )}
              </span>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
