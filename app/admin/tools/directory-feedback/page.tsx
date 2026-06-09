import Link from "next/link";
import { listDirectoryFeedback } from "@/lib/directory-feedback";
import {
  markFeedbackReadAction,
  dismissFeedbackAction,
} from "./actions";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date): string {
  const dd = d instanceof Date ? d : new Date(String(d));
  return dd.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const TOPIC_LABELS: Record<string, string> = {
  general: "General",
  profile: "About a profile",
  bug: "Bug / broken link",
};

export default async function DirectoryFeedbackPage() {
  const rows = await listDirectoryFeedback(true);

  return (
    <div className="max-w-[1000px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools" className="text-[color:var(--muted)] hover:text-navy">
          ← Tools
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Directory feedback
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-8">
        Notes submitted by read-only /directory users. Bug reports, bad
        links, suggestions, and profile-specific corrections live here.
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
          No unread feedback.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const alumName =
              [row.alum_first_name, row.alum_last_name].filter(Boolean).join(" ") ||
              null;
            return (
              <li
                key={row.id}
                className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <div className="text-[10px] tracking-[.22em] uppercase font-bold text-navy">
                      {TOPIC_LABELS[row.topic] ?? row.topic}
                    </div>
                    <div className="text-[11px] text-[color:var(--muted)]">
                      {fmtDateTime(row.created_at)}
                    </div>
                  </div>
                  <p className="text-sm text-[color:var(--navy-ink)] whitespace-pre-wrap">
                    {row.message}
                  </p>
                  <div className="text-xs text-[color:var(--muted)] mt-2 space-y-0.5">
                    {row.contact_name && <div>From: {row.contact_name}</div>}
                    {row.alumni_id && alumName && (
                      <div>
                        About:{" "}
                        <Link
                          href={`/admin/alumni/${row.alumni_id}`}
                          className="text-navy hover:underline"
                        >
                          {alumName}
                        </Link>
                      </div>
                    )}
                    {row.page_url && (
                      <div className="font-mono text-[11px] truncate">
                        {row.page_url}
                      </div>
                    )}
                    <div className="font-mono text-[10px] text-[color:var(--rule)]">
                      session {row.session_id.slice(0, 8) || "—"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <form action={markFeedbackReadAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="text-xs font-semibold text-navy hover:underline"
                    >
                      Mark read
                    </button>
                  </form>
                  <form action={dismissFeedbackAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="text-xs text-[color:var(--muted)] hover:text-rose-700"
                    >
                      Dismiss
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
