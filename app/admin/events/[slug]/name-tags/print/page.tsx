import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events-db";
import { listNameTagsForEvent, type NameTag } from "@/lib/event-name-tags";
import { PrintSheets } from "@/components/admin/NameTagPrintSheets";

export const dynamic = "force-dynamic";

export default async function NameTagsPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status: statusParam } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const all = await listNameTagsForEvent(event.id);
  const filter: "finalized" | "all" = statusParam === "all" ? "all" : "finalized";
  const tags = filter === "finalized" ? all.filter((t) => t.status === "finalized") : all;

  const counts = {
    total: all.length,
    finalized: all.filter((t) => t.status === "finalized").length,
    fix: all.filter((t) => t.status === "fix").length,
    pending: all.filter((t) => t.status === "pending").length,
  };

  return (
    <div>
      {/* Screen-only header. Hidden when printing. */}
      <div className="print:hidden bg-ivory border-b border-[color:var(--rule)] px-7 py-5">
        <div className="max-w-[1100px] mx-auto flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="mb-1 text-sm">
              <Link
                href={`/admin/events/${slug}/name-tags`}
                className="text-[color:var(--muted)] hover:text-navy"
              >
                ← Name tags
              </Link>
            </div>
            <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] leading-tight">
              Print {tags.length} name tag{tags.length === 1 ? "" : "s"}
            </h1>
            <p className="text-[color:var(--muted)] text-sm mt-1">
              {event.name} · 2 columns × 3 rows per sheet · 4&Prime; × 3&Prime; per insert
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs flex-wrap">
              {filter === "finalized" ? (
                <>
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                    Finalized only ({counts.finalized})
                  </span>
                  {counts.fix > 0 && (
                    <span className="text-rose-700">
                      {counts.fix} marked Fix — skipped
                    </span>
                  )}
                  {counts.pending > 0 && (
                    <span className="text-amber-700">
                      {counts.pending} pending — skipped
                    </span>
                  )}
                  <Link
                    href={`/admin/events/${slug}/name-tags/print?status=all`}
                    className="text-navy hover:underline"
                  >
                    Print all anyway →
                  </Link>
                </>
              ) : (
                <>
                  <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                    All statuses ({counts.total})
                  </span>
                  <Link
                    href={`/admin/events/${slug}/name-tags/print`}
                    className="text-navy hover:underline"
                  >
                    Switch to Finalized only →
                  </Link>
                </>
              )}
            </div>
          </div>
          <PrintButton disabled={tags.length === 0} />
        </div>
      </div>

      <PrintSheets tags={tags} layout={event.name_tag_layout ?? "standard"} />

      {tags.length === 0 && (
        <div className="print:hidden max-w-[600px] mx-auto my-16 text-center text-sm text-[color:var(--muted)]">
          {filter === "finalized"
            ? "No finalized tags yet. Mark tags as ✓ Finalized on the composer page, or click 'Print all anyway'."
            : "No tags to print."}
        </div>
      )}
    </div>
  );
}

function PrintButton({ disabled }: { disabled: boolean }) {
  return (
    <form
      action="javascript:window.print()"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <button
        type="submit"
        disabled={disabled}
        className="text-sm font-semibold text-white bg-navy px-5 py-2.5 rounded hover:opacity-90 disabled:opacity-50"
      >
        Print sheets
      </button>
    </form>
  );
}

// Type re-export to keep TS happy if NameTag is unused elsewhere on this file.
export type { NameTag };
