import Link from "next/link";
import { getGlobalRecentActivity } from "@/lib/directory-users";

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

const ACTION_LABEL: Record<string, string> = {
  search: "🔎 Search",
  profile_view: "👤 Profile view",
  linkedin_click: "↗ LinkedIn click",
  save: "⭐ Saved",
  unsave: "❌ Unsaved",
};

export default async function DirectoryActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const sp = await searchParams;
  const limit = Math.min(1000, Math.max(50, Number(sp.limit ?? 200) || 200));
  const rows = await getGlobalRecentActivity(limit);

  return (
    <section className="max-w-[1180px] mx-auto px-5 sm:px-7 py-8">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h1 className="font-sans text-[28px] font-bold text-[color:var(--navy-ink)]">
          Directory activity
        </h1>
        <Link
          href="/admin/tools/directory-users"
          className="text-sm text-navy hover:underline"
        >
          ← Back to users
        </Link>
      </div>
      <p className="text-sm text-[color:var(--muted)] mb-6 max-w-prose">
        Last {limit} events across all directory users. Sourced from{" "}
        <code>directory_views</code> — every search, profile open, LinkedIn
        click-out, and save / unsave is logged. Click a user's email to drill
        into just their activity.
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
          No directory activity yet.
        </div>
      ) : (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--ivory-2)] text-[11px] tracking-[.18em] uppercase text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-3 py-2 font-bold">When</th>
                <th className="text-left px-3 py-2 font-bold">User</th>
                <th className="text-left px-3 py-2 font-bold">Where</th>
                <th className="text-left px-3 py-2 font-bold">Action</th>
                <th className="text-left px-3 py-2 font-bold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className="border-t border-[color:var(--rule)] hover:bg-[color:var(--ivory-2)]"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-[color:var(--muted)]">
                    {fmtTs(r.at)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link
                      href={`/admin/tools/directory-users/${r.user_id}`}
                      className="text-navy hover:underline"
                      title={r.user_email}
                    >
                      {r.user_first_name ?? r.user_email}
                    </Link>
                  </td>
                  <td
                    className="px-3 py-2 whitespace-nowrap text-[color:var(--muted)]"
                    title={r.user_agent ?? undefined}
                  >
                    {[r.city, r.region, r.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ACTION_LABEL[r.action] ?? r.action}
                  </td>
                  <td className="px-3 py-2 text-[color:var(--navy-ink)]">
                    {r.target_name ? (
                      <Link
                        href={`/directory/${r.target_id}`}
                        className="underline decoration-dotted hover:text-navy"
                      >
                        {r.target_name}
                      </Link>
                    ) : r.query_json ? (
                      <code className="text-xs text-[color:var(--muted)]">
                        {typeof r.query_json === "string"
                          ? r.query_json.slice(0, 80)
                          : JSON.stringify(r.query_json).slice(0, 80)}
                      </code>
                    ) : (
                      <span className="text-[color:var(--muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
