import Link from "next/link";
import { listVisitingRequests, whatsappUrl } from "@/lib/visiting-requests";
import { fmtDateTimeShort } from "@/lib/admin-time";
import { toggleContactedAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VisitingRequestsPage() {
  const rows = await listVisitingRequests();
  const pending = rows.filter((r) => !r.contacted_at).length;

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools" className="text-[color:var(--muted)] hover:text-navy">
          ← Tools
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Just visiting · WhatsApp requests
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6 max-w-[640px]">
        UWC alumni passing through the Bay Area who&rsquo;ve asked for the
        WhatsApp join link via the homepage modal. Sorted newest first.
        Mark contacted once you&rsquo;ve sent them the invite.
      </p>

      <div className="flex gap-4 mb-6 text-sm">
        <span className="bg-white border border-[color:var(--rule)] rounded px-3 py-1.5">
          <strong className="text-[color:var(--navy-ink)]">{rows.length}</strong>
          <span className="text-[color:var(--muted)]"> total</span>
        </span>
        <span className="bg-white border border-[color:var(--rule)] rounded px-3 py-1.5">
          <strong className="text-amber-700">{pending}</strong>
          <span className="text-[color:var(--muted)]"> pending</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
          No visiting requests yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const wa = whatsappUrl(r.phone);
            const fullName = `${r.first_name} ${r.last_name}`.trim();
            const contacted = !!r.contacted_at;
            return (
              <li
                key={r.id}
                className={`bg-white border rounded-[10px] p-4 ${
                  contacted
                    ? "border-[color:var(--rule)] opacity-70"
                    : "border-[color:var(--rule)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[color:var(--navy-ink)]">
                      {fullName}
                      {r.affiliation && (
                        <span className="ml-2 text-xs text-[color:var(--muted)] font-normal">
                          {r.affiliation}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[color:var(--muted)] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <a
                        href={`mailto:${r.email}`}
                        className="hover:text-navy hover:underline"
                      >
                        ✉ {r.email}
                      </a>
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-navy hover:underline"
                        >
                          📱 {r.phone} → wa.me
                        </a>
                      ) : (
                        <span>📱 {r.phone}</span>
                      )}
                    </div>
                    {r.note && (
                      <div className="text-sm text-[color:var(--navy-ink)] mt-2 whitespace-pre-wrap">
                        {r.note}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="text-[10px] tracking-[.18em] uppercase text-[color:var(--muted)] font-bold">
                      {fmtDateTimeShort(r.created_at)}
                    </div>
                    <form action={toggleContactedAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input
                        type="hidden"
                        name="contacted"
                        value={contacted ? "0" : "1"}
                      />
                      <button
                        type="submit"
                        className={`text-xs font-semibold px-2.5 py-1 rounded ${
                          contacted
                            ? "border border-[color:var(--rule)] text-[color:var(--muted)] hover:text-navy"
                            : "bg-navy text-white hover:opacity-90"
                        }`}
                      >
                        {contacted
                          ? `✓ Contacted ${r.contacted_at ? fmtDateTimeShort(r.contacted_at) : ""}`
                          : "Mark contacted"}
                      </button>
                    </form>
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
