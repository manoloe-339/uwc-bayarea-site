import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ToolsIndex() {
  return (
    <div className="max-w-[800px]">
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">Admin tools</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        LLM-assisted data-quality tools. Runs on demand, writes to tag tables
        that alumni filters can read.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/admin/tools/classify"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Company classifier</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Tech / startup / public / subsidiary labels</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            One Claude call per unique company. Writes richer labels than LinkedIn&rsquo;s
            industry tag so filters like &ldquo;non-tech&rdquo; and &ldquo;real startup&rdquo; actually work.
          </p>
        </Link>
        <Link
          href="/admin/tools/duplicates"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Find duplicates</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Alumni rows sharing a LinkedIn URL or name</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Groups confirmed-dupe rows side-by-side with email, submit date,
            enrichment counts, and per-row Delete / swap-email actions. Safe
            to re-run any time new data comes in.
          </p>
        </Link>
        <Link
          href="/admin/tools/gender"
          className="block bg-white border border-[color:var(--rule)] rounded-[10px] p-5 hover:border-navy"
        >
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">Gender classifier</div>
          <div className="font-semibold text-[color:var(--navy-ink)]">Male / female / they / unknown</div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Uses first name + origin country + LinkedIn pronouns to classify
            each alumnus. Admin overrides on the detail page are preserved
            and never auto-overwritten.
          </p>
        </Link>
      </div>
    </div>
  );
}
