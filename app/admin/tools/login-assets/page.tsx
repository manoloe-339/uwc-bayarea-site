import { sql } from "@/lib/db";
import { createLoginAsset, deleteLoginAsset } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  kind: "university_logo" | "company_logo" | "flag";
  label: string;
  image_url: string;
};

const KIND_LABELS: Record<Row["kind"], string> = {
  university_logo: "University logo",
  company_logo: "Company logo",
  flag: "Flag",
};

export default async function LoginAssetsPage() {
  const rows = (await sql`
    SELECT id, kind, label, image_url
    FROM login_assets
    ORDER BY kind ASC, label ASC
  `) as Row[];

  const groups: Record<Row["kind"], Row[]> = {
    university_logo: [],
    company_logo: [],
    flag: [],
  };
  for (const r of rows) groups[r.kind].push(r);

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-[color:var(--navy-ink)]">
        Login asset library
      </h1>
      <p className="text-[color:var(--muted)] mt-2 text-sm leading-relaxed max-w-prose">
        Curated non-UWC visuals for the <code>/directory/login</code> backdrop.
        Each asset has a kind (university logo / company logo / flag) so the
        backdrop can mix them in at the right ratio. UWC assets live on their
        own page (<a className="underline" href="/admin/tools/uwc-assets">UWC
        assets</a>) — these supplement the photo + UWC pools the login already
        draws from.
      </p>

      <section className="mt-8 bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
        <h2 className="font-bold text-[color:var(--navy-ink)] mb-3">
          Add asset
        </h2>
        <form
          action={createLoginAsset}
          className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end"
        >
          <label className="block">
            <span className="block text-[11px] tracking-[.16em] uppercase font-bold text-[color:var(--muted)] mb-1">
              Kind
            </span>
            <select
              name="kind"
              required
              defaultValue="university_logo"
              className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
            >
              <option value="university_logo">University logo</option>
              <option value="company_logo">Company logo</option>
              <option value="flag">Flag</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] tracking-[.16em] uppercase font-bold text-[color:var(--muted)] mb-1">
              Label
            </span>
            <input
              type="text"
              name="label"
              required
              maxLength={80}
              placeholder='e.g. "Stanford GSB" / "Google" / "Brazil"'
              className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
            />
          </label>
          <div className="flex items-end gap-2">
            <input
              type="file"
              name="file"
              accept="image/*"
              required
              className="text-xs"
            />
            <button
              type="submit"
              className="bg-navy text-white text-sm font-bold px-4 py-1.5 rounded"
            >
              Add
            </button>
          </div>
        </form>
      </section>

      <div className="mt-8 space-y-8">
        {(["university_logo", "company_logo", "flag"] as Row["kind"][]).map(
          (kind) => (
            <section key={kind}>
              <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
                {KIND_LABELS[kind]} · {groups[kind].length}
              </h2>
              {groups[kind].length === 0 ? (
                <p className="text-sm text-[color:var(--muted)] italic">
                  No entries yet.
                </p>
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {groups[kind].map((r) => (
                    <li
                      key={r.id}
                      className="bg-white border border-[color:var(--rule)] rounded-md p-3"
                    >
                      <div className="aspect-square bg-[color:var(--ivory-2)] rounded mb-2 overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.image_url}
                          alt={r.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-xs font-bold text-[color:var(--navy-ink)] truncate">
                        {r.label}
                      </div>
                      <form action={deleteLoginAsset} className="mt-2">
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="text-[11px] text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ),
        )}
      </div>
    </div>
  );
}
