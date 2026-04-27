import Link from "next/link";
import { listAllInviteLists } from "@/lib/invite-lists";
import { fmtDate } from "@/lib/admin-time";

export const dynamic = "force-dynamic";

export default async function EventsIndexPage() {
  const lists = await listAllInviteLists();

  return (
    <div className="max-w-[1000px]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Event lists</h1>
          <p className="text-[color:var(--muted)] text-sm">
            {lists.length} {lists.length === 1 ? "list" : "lists"}
          </p>
        </div>
        <Link
          href="/admin/alumni"
          className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
        >
          Find alumni to invite
        </Link>
      </div>

      {lists.length === 0 ? (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-8 text-center text-sm text-[color:var(--muted)]">
          No invite lists yet.
          <br />
          Use the alumni search to select people, then click{" "}
          <span className="font-semibold text-navy">Save as invite list</span>.
        </div>
      ) : (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Invites</th>
                <th className="text-left px-4 py-2">Event date</th>
                <th className="text-left px-4 py-2">Location</th>
                <th className="text-left px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <tr key={l.id} className="border-t border-[color:var(--rule)]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/email/invite-lists/${l.id}`} className="font-semibold text-navy hover:underline">
                      {l.name}
                    </Link>
                    {l.description && (
                      <div className="text-xs text-[color:var(--muted)] mt-0.5 line-clamp-1">
                        {l.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{l.member_count}</td>
                  <td className="px-4 py-3 text-xs">
                    {l.event_date ? fmtDate(l.event_date) : <span className="text-[color:var(--muted)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.event_location ?? <span className="text-[color:var(--muted)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">{fmtDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
