import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events-db";
import { listNameTagsForEvent } from "@/lib/event-name-tags";
import { NameTagComposer } from "@/components/admin/NameTagComposer";

export const dynamic = "force-dynamic";

export default async function NameTagsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const tags = await listNameTagsForEvent(event.id);

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link
          href={`/admin/events/${slug}/attendees`}
          className="text-[color:var(--muted)] hover:text-navy"
        >
          ← {event.name}
        </Link>
      </div>

      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">
            Name tags
          </h1>
          <p className="text-[color:var(--muted)] text-sm">
            {event.name}
            {event.date
              ? ` · ${new Date(event.date).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}`
              : ""}
          </p>
        </div>
        <Link
          href={`/admin/events/${slug}/name-tags/print`}
          className="text-sm font-semibold text-white bg-navy px-5 py-2.5 rounded hover:opacity-90"
        >
          Print sheets →
        </Link>
      </div>

      <p className="text-xs text-[color:var(--muted)] mb-5 max-w-prose">
        Tags pull from ticket purchasers via <strong>Sync new attendees</strong>{" "}
        (re-runnable; never overwrites edits). Use <strong>+ Add tag</strong>{" "}
        for non-purchaser guests, partners, VIPs. Each tag prints up to four lines:
        name, college · year, plus two free-form lines.
      </p>

      <NameTagComposer
        eventId={event.id}
        initialTags={tags}
        initialLayout={event.name_tag_layout ?? "standard"}
      />
    </div>
  );
}
