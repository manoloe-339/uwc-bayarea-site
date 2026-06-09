import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDirectorySession } from "@/lib/directory-session";
import {
  listSavesForUser,
  SAVE_STATUSES,
  STATUS_LABELS,
  type SaveStatus,
} from "@/lib/directory-saves";
import SavedRow from "@/components/directory/SavedRow";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
function pickStr(sp: SP, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

const STATUS_COLORS: Record<SaveStatus, string> = {
  not_contacted: "bg-slate-100 text-slate-800 border-slate-200",
  invite_sent: "bg-amber-50 text-amber-800 border-amber-200",
  connected: "bg-emerald-50 text-emerald-800 border-emerald-200",
  replied: "bg-sky-50 text-sky-800 border-sky-200",
  met: "bg-violet-50 text-violet-800 border-violet-200",
  follow_up_later: "bg-orange-50 text-orange-800 border-orange-200",
};

export default async function SavedShortlistPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await getCurrentDirectorySession();
  if (!session) redirect("/directory/login?next=%2Fdirectory%2Fsaved");
  if (session.kind !== "user") {
    return (
      <section className="max-w-[800px] mx-auto px-5 sm:px-7 py-10">
        <h1 className="font-sans text-2xl font-bold text-[color:var(--navy-ink)] mb-2">
          Sign in with a personal account
        </h1>
        <p className="text-[color:var(--muted)] text-sm">
          The saved-shortlist feature requires a personal directory account.
          Ask the admin to invite you, or sign out and back in with your
          personal credentials.
        </p>
      </section>
    );
  }

  const sp = await searchParams;
  const statusFilter = pickStr(sp, "status") as SaveStatus | undefined;

  const allSaves = await listSavesForUser(session.user.id);
  // Counts by status for the chip bar.
  const counts: Record<SaveStatus, number> = {
    not_contacted: 0,
    invite_sent: 0,
    connected: 0,
    replied: 0,
    met: 0,
    follow_up_later: 0,
  };
  for (const s of allSaves) {
    if (statusFilter === undefined || s.status in counts) counts[s.status] += 1;
  }
  const filtered = statusFilter
    ? allSaves.filter((s) => s.status === statusFilter)
    : allSaves;

  return (
    <section className="max-w-[900px] mx-auto px-5 sm:px-7 py-8">
      <div className="mb-5">
        <h1 className="font-sans text-[28px] sm:text-[34px] font-bold text-[color:var(--navy-ink)] tracking-[-0.01em]">
          Your shortlist
        </h1>
        <p className="text-sm text-[color:var(--muted)] mt-1">
          {allSaves.length} saved · personal to your account
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Link
          href="/directory/saved"
          className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border ${
            !statusFilter
              ? "bg-navy text-white border-navy"
              : "border-[color:var(--rule)] text-[color:var(--muted)] hover:text-navy hover:border-navy"
          }`}
        >
          All ({allSaves.length})
        </Link>
        {SAVE_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/directory/saved?status=${s}`}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border ${
              statusFilter === s
                ? "bg-navy text-white border-navy"
                : `${STATUS_COLORS[s]} hover:opacity-90`
            }`}
          >
            {STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
          {allSaves.length === 0
            ? "Nothing saved yet. Click ★ Save on any profile to start."
            : "No saves match that status."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <SavedRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
