import Link from "next/link";
import { findDuplicates } from "@/lib/duplicates";
import { fmtDate } from "@/lib/admin-time";
import { deleteAlumniAction, swapAndDeleteAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const groups = await findDuplicates();

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools" className="text-[color:var(--muted)] hover:text-navy">
          ← Admin tools
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Find duplicates
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Alumni rows that share a LinkedIn URL or a first+last name. Each
        group below is almost certainly the same person — delete the extras.
      </p>

      {groups.length === 0 ? (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-8 text-center text-sm text-[color:var(--muted)]">
          No duplicate pairs detected. ✓
        </div>
      ) : (
        <>
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-3">
            {groups.length} group{groups.length === 1 ? "" : "s"}
          </div>
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.key} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
                      {g.signal === "linkedin_url" ? "Same LinkedIn URL" : "Same name"}
                    </div>
                    <div className="text-sm text-[color:var(--navy-ink)] font-semibold break-all">
                      {g.signalLabel}
                    </div>
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {g.members.length} rows
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead className="text-[10px] tracking-[.16em] uppercase font-bold text-[color:var(--muted)]">
                    <tr>
                      <th className="text-left pb-1.5">Row</th>
                      <th className="text-left pb-1.5">Email</th>
                      <th className="text-left pb-1.5">Submitted</th>
                      <th className="text-left pb-1.5">Current</th>
                      <th className="text-left pb-1.5">Data</th>
                      <th className="text-right pb-1.5">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.members.map((m) => {
                      const del = deleteAlumniAction.bind(null, m.id);
                      const fullName = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
                      const others = g.members.filter((o) => o.id !== m.id);
                      return (
                        <tr key={m.id} className="border-t border-[color:var(--rule)] align-top">
                          <td className="py-1.5 pr-2">
                            <Link
                              href={`/admin/alumni/${m.id}`}
                              className="font-semibold text-navy hover:underline"
                            >
                              #{m.id} · {fullName}
                            </Link>
                            <div className="text-[10px] text-[color:var(--muted)]">
                              {m.uwc_college ?? "—"}
                              {m.grad_year ? ` · ${m.grad_year}` : ""}
                              {m.current_city ? ` · ${m.current_city}` : ""}
                              {m.deceased ? " · ✝ deceased" : ""}
                            </div>
                          </td>
                          <td className="py-1.5 pr-2 break-all">{m.email}</td>
                          <td className="py-1.5 pr-2 text-[color:var(--muted)]">
                            {m.submitted_at ? fmtDate(m.submitted_at) : "—"}
                          </td>
                          <td className="py-1.5 pr-2">
                            {m.current_title || m.current_company ? (
                              <>
                                <div className="text-[color:var(--navy-ink)]">{m.current_title ?? ""}</div>
                                <div className="text-[10px] text-[color:var(--muted)]">@ {m.current_company ?? ""}</div>
                              </>
                            ) : (
                              <span className="text-[color:var(--muted)]">—</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-2 text-[color:var(--muted)]">
                            c/e/v={m.career_count}/{m.edu_count}/{m.vol_count}
                            {m.send_count > 0 ? ` · ${m.send_count} sends` : ""}
                            {m.photo_url ? " · photo" : ""}
                          </td>
                          <td className="py-1.5 text-right whitespace-nowrap">
                            <div className="flex flex-col items-end gap-1">
                              <form action={del}>
                                <button
                                  type="submit"
                                  className="text-[11px] text-red-700 hover:underline"
                                >
                                  Delete #{m.id}
                                </button>
                              </form>
                              {others.map((o) => {
                                if (!m.email || m.email === o.email) return null;
                                const swap = swapAndDeleteAction.bind(null, o.id, m.id, m.email);
                                return (
                                  <form key={o.id} action={swap}>
                                    <button
                                      type="submit"
                                      className="text-[10px] text-navy hover:underline"
                                      title={`Move ${m.email} onto #${o.id} and delete #${m.id}`}
                                    >
                                      Delete #{m.id} + move email to #{o.id}
                                    </button>
                                  </form>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
