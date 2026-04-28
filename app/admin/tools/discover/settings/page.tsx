import Link from "next/link";
import { sql } from "@/lib/db";
import { getSiteSettings, DEFAULT_LINKEDIN_INVITE_TEMPLATE } from "@/lib/settings";
import {
  saveInviteTemplate,
  addQuery,
  updateQuery,
  toggleQuery,
  deleteQuery,
  addTerm,
  deleteTerm,
} from "./actions";

export const dynamic = "force-dynamic";

type QueryRow = {
  id: number;
  query: string;
  group_label: string | null;
  enabled: boolean;
  sort_order: number;
};

type TermRow = {
  id: number;
  term: string;
  note: string | null;
};

const SAVED_LABEL: Record<string, string> = {
  invite: "Invite template saved.",
  query: "Search queries updated.",
  term: "Excluded terms updated.",
};

export default async function DiscoverySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const savedMessage = sp.saved ? SAVED_LABEL[sp.saved] : null;
  const [settings, queriesRaw, termsRaw] = await Promise.all([
    getSiteSettings(),
    sql`SELECT id, query, group_label, enabled, sort_order
        FROM discovery_query_templates
        ORDER BY sort_order ASC, id ASC`,
    sql`SELECT id, term, note FROM discovery_excluded_terms ORDER BY term ASC`,
  ]);
  const queries = queriesRaw as unknown as QueryRow[];
  const terms = termsRaw as unknown as TermRow[];

  const enabledCount = queries.filter((q) => q.enabled).length;

  return (
    <div className="max-w-[1000px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools/discover" className="text-[color:var(--muted)] hover:text-navy">
          ← Discover alumni
        </Link>
      </div>

      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Discovery settings
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Search queries, excluded terms, and the LinkedIn invite template.
      </p>

      {savedMessage && (
        <div className="mb-6 px-3 py-2 rounded bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          ✓ {savedMessage}
        </div>
      )}

      {/* LinkedIn invite */}
      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-8">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
          LinkedIn invite template
        </h2>
        <p className="text-xs text-[color:var(--muted)] mb-3">
          Note copied to clipboard when you click <strong>Copy invite + open
          LinkedIn</strong> on a confirmed candidate. Use{" "}
          <code className="font-mono bg-ivory-2 px-1 rounded">{`{firstName}`}</code>{" "}
          where the candidate&apos;s first name should go — it&apos;s replaced
          on copy, or stripped if no name was extracted. Keep under ~200
          characters (LinkedIn&apos;s &ldquo;Add a note&rdquo; limit on free accounts).
        </p>
        <form action={saveInviteTemplate}>
          <textarea
            name="linkedin_invite_template"
            defaultValue={settings.linkedin_invite_template ?? DEFAULT_LINKEDIN_INVITE_TEMPLATE}
            rows={4}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-sans"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold"
            >
              Save invite template
            </button>
          </div>
        </form>
      </section>

      {/* Queries */}
      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-8">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <div>
            <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
              Search queries
            </h2>
            <p className="text-xs text-[color:var(--muted)]">
              {enabledCount} of {queries.length} enabled. Disable noisy queries
              instead of deleting so we can re-enable later.
            </p>
          </div>
        </div>

        <div className="border border-[color:var(--rule)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-3 py-2 w-[60%]">Query</th>
                <th className="text-left px-3 py-2">Group</th>
                <th className="text-left px-3 py-2 w-[140px]">State</th>
                <th className="text-right px-3 py-2 w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => (
                <tr
                  key={q.id}
                  className={`border-t border-[color:var(--rule)] ${q.enabled ? "" : "opacity-50"}`}
                >
                  <td className="px-3 py-2 font-mono text-[12px] text-[color:var(--navy-ink)]">
                    <form action={updateQuery} className="flex gap-2">
                      <input type="hidden" name="id" value={q.id} />
                      <input
                        name="query"
                        defaultValue={q.query}
                        className="flex-1 border border-transparent rounded px-1 py-0.5 hover:border-[color:var(--rule)] focus:border-navy outline-none bg-transparent font-mono"
                      />
                      <input
                        type="hidden"
                        name="group_label"
                        defaultValue={q.group_label ?? ""}
                      />
                      <button
                        type="submit"
                        className="text-[10px] tracking-[.1em] uppercase font-bold text-navy hover:underline"
                      >
                        save
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-xs text-[color:var(--muted)]">
                    {q.group_label}
                  </td>
                  <td className="px-3 py-2">
                    <form action={toggleQuery}>
                      <input type="hidden" name="id" value={q.id} />
                      <button
                        type="submit"
                        className={`text-[10px] tracking-[.1em] uppercase font-bold px-2 py-0.5 rounded border ${
                          q.enabled
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-[color:var(--rule)] text-[color:var(--muted)] border-[color:var(--rule)] hover:bg-ivory"
                        }`}
                      >
                        {q.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={deleteQuery}>
                      <input type="hidden" name="id" value={q.id} />
                      <button
                        type="submit"
                        className="text-[10px] tracking-[.1em] uppercase font-bold text-rose-700 hover:underline"
                      >
                        delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={addQuery} className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2 items-stretch">
          <input
            name="query"
            placeholder='e.g. "UWC" "Sausalito" site:linkedin.com/in/'
            required
            className="border border-[color:var(--rule)] rounded px-3 py-2 text-sm font-mono bg-white"
          />
          <input
            name="group_label"
            placeholder="group (optional)"
            className="border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
          <button
            type="submit"
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
          >
            Add query
          </button>
        </form>
      </section>

      {/* Excluded terms */}
      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-8">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
          Excluded terms
        </h2>
        <p className="text-xs text-[color:var(--muted)] mb-3">
          Hits whose title or snippet contains any of these (case-insensitive)
          are dropped before triage. Use this for known false-positive classes.
        </p>

        <div className="border border-[color:var(--rule)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-3 py-2">Term</th>
                <th className="text-left px-3 py-2">Note</th>
                <th className="text-right px-3 py-2 w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id} className="border-t border-[color:var(--rule)]">
                  <td className="px-3 py-2 font-mono text-[12px]">{t.term}</td>
                  <td className="px-3 py-2 text-xs text-[color:var(--muted)]">
                    {t.note ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={deleteTerm}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className="text-[10px] tracking-[.1em] uppercase font-bold text-rose-700 hover:underline"
                      >
                        delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {terms.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-sm text-[color:var(--muted)]">
                    No excluded terms.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action={addTerm} className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-stretch">
          <input
            name="term"
            placeholder="e.g. Western Cape"
            required
            className="border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
          <input
            name="note"
            placeholder="why excluded (optional)"
            className="border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
          <button
            type="submit"
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
          >
            Add term
          </button>
        </form>
      </section>
    </div>
  );
}
