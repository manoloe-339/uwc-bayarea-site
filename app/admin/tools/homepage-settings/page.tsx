import Link from "next/link";
import { listHeroSlidesForAdmin } from "@/lib/hero-slides";
import { toggleHeroSlideEnabledAction } from "./actions";
import { DeleteSlideButton } from "./DeleteSlideButton";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "";
  const dd = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(dd.getTime())) return "";
  return dd.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function HomepageSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const slides = await listHeroSlidesForAdmin();

  return (
    <div className="max-w-[960px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools" className="text-[color:var(--muted)] hover:text-navy">
          ← Tools
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Homepage settings
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6 max-w-[640px]">
        Manage the hero carousel on{" "}
        <Link href="/preview-home" className="underline">/preview-home</Link>.
        With no enabled slides, the hero auto-derives from your most recent past
        events with photos.
      </p>

      {sp.saved === "1" && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-900 text-sm rounded">
          Saved.
        </div>
      )}

      <div className="flex justify-between items-center mb-3">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
          Hero carousel slides
        </h2>
        <Link
          href="/admin/tools/homepage-settings/slides/new"
          className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
        >
          + New slide
        </Link>
      </div>

      {slides.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
          No slides yet. The hero is showing auto-derived slides from recent
          past events with photos. Add a slide to take editorial control.
        </div>
      ) : (
        <ul className="space-y-3">
          {slides.map((s) => (
            <li
              key={s.id}
              className={`bg-white border rounded-[10px] p-4 flex items-start gap-4 ${
                s.enabled ? "border-[color:var(--rule)]" : "border-dashed border-[color:var(--rule)] opacity-60"
              }`}
            >
              <div className="text-xs text-[color:var(--muted)] font-mono w-8 text-right pt-0.5">
                #{s.sort_order}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] tracking-[.22em] uppercase font-bold text-navy">
                  {s.eyebrow ?? (s.event_date ? fmtDate(s.event_date) : "—")}
                </div>
                <div className="font-serif text-xl text-[color:var(--navy-ink)] mt-0.5">
                  {s.title}{" "}
                  {s.emphasis && <em className="italic">{s.emphasis}</em>}
                </div>
                {s.byline && (
                  <div className="text-sm text-[color:var(--muted)] mt-1">{s.byline}</div>
                )}
                {s.event_name && (
                  <div className="text-xs text-[color:var(--muted)] mt-1">
                    Linked event: <span className="font-semibold">{s.event_name}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Link
                  href={`/admin/tools/homepage-settings/slides/${s.id}/edit`}
                  className="text-xs font-semibold text-navy hover:underline"
                >
                  Edit
                </Link>
                <form action={toggleHeroSlideEnabledAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="enabled" value={s.enabled ? "0" : "1"} />
                  <button
                    type="submit"
                    className={`text-xs font-semibold ${
                      s.enabled ? "text-[color:var(--muted)] hover:text-navy" : "text-navy hover:underline"
                    }`}
                  >
                    {s.enabled ? "Disable" : "Enable"}
                  </button>
                </form>
                <DeleteSlideButton id={s.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
