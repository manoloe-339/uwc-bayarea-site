import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events-db";
import { BlankPrintSheets } from "@/components/admin/BlankNameTagPrintSheets";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

const MAX_SHEETS = 20;
const DEFAULT_SHEETS = 2;

export default async function BlankNameTagsPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sheets?: string }>;
}) {
  const { slug } = await params;
  const { sheets: sheetsParam } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const requested = Number(sheetsParam ?? DEFAULT_SHEETS);
  const sheets = Number.isFinite(requested)
    ? Math.max(1, Math.min(MAX_SHEETS, Math.trunc(requested)))
    : DEFAULT_SHEETS;

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
              Print {sheets} blank sheet{sheets === 1 ? "" : "s"}
            </h1>
            <p className="text-[color:var(--muted)] text-sm mt-1">
              {event.name} · 6 empty 4&Prime;×3&Prime; tags per sheet · for write-ins at the door
            </p>
            <div className="mt-2 flex items-center gap-1 text-xs flex-wrap">
              <span className="text-[color:var(--muted)] mr-1">Sheets:</span>
              {[1, 2, 3, 5, 10].map((n) => (
                <Link
                  key={n}
                  href={`/admin/events/${slug}/name-tags/print-blank?sheets=${n}`}
                  className={`px-2 py-1 rounded border ${
                    n === sheets
                      ? "bg-navy text-white border-navy"
                      : "bg-white text-navy border-[color:var(--rule)] hover:border-navy"
                  }`}
                >
                  {n}
                </Link>
              ))}
            </div>
          </div>
          <PrintButton disabled={false} />
        </div>
      </div>

      <BlankPrintSheets sheetCount={sheets} />
    </div>
  );
}
