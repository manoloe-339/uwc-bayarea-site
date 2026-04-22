import Link from "next/link";
import { notFound } from "next/navigation";
import { getInviteList, getInviteListMembers } from "@/lib/invite-lists";
import { fmtDate } from "@/lib/admin-time";
import { deleteListAction, removeMemberAction, updateListAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function InviteListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const list = await getInviteList(id);
  if (!list) notFound();
  const members = await getInviteListMembers(id);

  const ids = members.map((m) => m.alumni_id).join(",");
  const sendHref = ids ? `/admin/email/campaigns/new?ids=${ids}` : "";

  const update = updateListAction.bind(null, id);
  const del = deleteListAction.bind(null, id);

  return (
    <div className="max-w-[1000px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/events" className="text-[color:var(--muted)] hover:text-navy">
          ← Back to event lists
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">{list.name}</h1>
          <p className="text-[color:var(--muted)] text-sm mt-1">
            {members.length} {members.length === 1 ? "invite" : "invites"}
            {list.event_date ? ` · ${fmtDate(list.event_date)}` : ""}
            {list.event_location ? ` · ${list.event_location}` : ""}
            {" · Created "}{fmtDate(list.created_at)}
          </p>
          {list.description && (
            <p className="text-sm text-[color:var(--navy-ink)] italic mt-2">{list.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {sendHref && (
            <Link
              href={sendHref}
              className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded hover:brightness-110"
            >
              Send email →
            </Link>
          )}
          <Link
            href={`/admin/alumni?addToList=${id}`}
            className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
          >
            Add more people
          </Link>
        </div>
      </div>

      {saved && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">Saved.</div>
      )}

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 mb-6 space-y-3">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">List details</h2>
        <form action={update} className="grid sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">Name</span>
            <input
              name="name"
              defaultValue={list.name}
              required
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">Event date</span>
            <input
              type="date"
              name="event_date"
              defaultValue={list.event_date ?? ""}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">Event location</span>
            <input
              name="event_location"
              defaultValue={list.event_location ?? ""}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">Description</span>
            <textarea
              name="description"
              defaultValue={list.description ?? ""}
              rows={2}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
          <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-[color:var(--rule)]">
            <button type="submit" className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold">
              Save details
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden mb-6">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-5 py-4 border-b border-[color:var(--rule)]">
          Invitees ({members.length})
        </h2>
        {members.length === 0 ? (
          <div className="p-6 text-center text-sm text-[color:var(--muted)]">
            No members yet. Click <span className="font-semibold text-navy">Add more people</span> to go to the alumni search.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">City</th>
                <th className="text-left px-4 py-2">Added</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
                const role = [m.current_title, m.current_company].filter(Boolean).join(" @ ");
                const remove = removeMemberAction.bind(null, id, m.alumni_id);
                return (
                  <tr key={m.id} className="border-t border-[color:var(--rule)]">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/alumni/${m.alumni_id}`} className="font-semibold text-navy hover:underline">
                        {name}
                      </Link>
                      <div className="text-xs text-[color:var(--muted)]">{m.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {role || <span className="text-[color:var(--muted)]">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {m.location_city ?? <span className="text-[color:var(--muted)]">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{fmtDate(m.added_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <form action={remove}>
                        <button
                          type="submit"
                          className="text-xs text-red-700 hover:underline"
                          aria-label={`Remove ${name}`}
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-red-200 rounded-[10px] p-6">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-red-800 mb-2">Danger zone</h2>
        <form action={del} className="flex items-center justify-between gap-4">
          <p className="text-sm text-[color:var(--muted)]">
            Delete this invite list. Does not touch the alumni records themselves.
          </p>
          <button type="submit" className="text-sm font-semibold text-red-700 border border-red-300 px-4 py-2 rounded hover:bg-red-50">
            Delete list
          </button>
        </form>
      </section>
    </div>
  );
}
