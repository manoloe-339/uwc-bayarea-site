import Link from "next/link";
import { sql } from "@/lib/db";
import { createListAction } from "../actions";

export const dynamic = "force-dynamic";

type AlumPreview = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  current_title: string | null;
  current_company: string | null;
};

function parseIds(sp: Record<string, string | string[] | undefined>): number[] {
  const raw = sp["ids"];
  return (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .flatMap((v) => String(v).split(","))
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export default async function NewInviteListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ids = Array.from(new Set(parseIds(sp)));

  let preview: AlumPreview[] = [];
  if (ids.length > 0) {
    preview = (await sql`
      SELECT id, first_name, last_name, email, current_title, current_company
      FROM alumni
      WHERE id = ANY(${ids})
      ORDER BY last_name ASC NULLS LAST, first_name ASC NULLS LAST
    `) as AlumPreview[];
  }

  return (
    <div className="max-w-[800px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/events" className="text-[color:var(--muted)] hover:text-navy">
          ← Back to event lists
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-2">New invite list</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        {ids.length > 0
          ? `${ids.length} alumni selected — name the list below.`
          : "No alumni selected. Pick people from the alumni search first, or save an empty list and add members later."}
      </p>

      <form action={createListAction} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 space-y-4">
        {ids.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
            Name
          </span>
          <input
            type="text"
            name="name"
            required
            placeholder="e.g. Tech Leadership Dinner"
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
              Event date (optional)
            </span>
            <input
              type="date"
              name="event_date"
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
              Event location (optional)
            </span>
            <input
              type="text"
              name="event_location"
              placeholder="e.g. San Francisco"
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
            Description (optional)
          </span>
          <textarea
            name="description"
            rows={3}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>

        <div className="flex items-center gap-2 pt-2 border-t border-[color:var(--rule)]">
          <button type="submit" className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold">
            Create list
          </button>
          <Link href="/admin/events" className="px-5 py-2.5 text-sm text-[color:var(--muted)] hover:text-navy">
            Cancel
          </Link>
        </div>
      </form>

      {preview.length > 0 && (
        <div className="mt-6 bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
          <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-5 py-4 border-b border-[color:var(--rule)]">
            Selected ({preview.length})
          </h2>
          <ul className="divide-y divide-[color:var(--rule)]">
            {preview.map((a) => {
              const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || a.email;
              const role = [a.current_title, a.current_company].filter(Boolean).join(" @ ");
              return (
                <li key={a.id} className="px-5 py-2.5 text-sm flex justify-between gap-4">
                  <span className="font-semibold text-navy">{name}</span>
                  <span className="text-xs text-[color:var(--muted)] truncate">{role || "—"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
