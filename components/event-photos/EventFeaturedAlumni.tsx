import type { FeaturedAlumnusRow } from "@/lib/event-featured-alumni";

function deriveCurrentRole(a: FeaturedAlumnusRow): string | null {
  // role_label override wins (e.g. "Guest speaker", "Co-host").
  if (a.role_label && a.role_label.trim()) return a.role_label.trim();
  const title = (a.current_title ?? "").trim();
  const company = (a.current_company ?? "").trim();
  if (title && company) return `${title} at ${company}`;
  if (title) return title;
  if (company) return `At ${company}`;
  return null;
}

function bylineText(a: FeaturedAlumnusRow): string {
  const yy = a.grad_year ? `'${String(a.grad_year).slice(-2)}` : "";
  return [a.uwc_college, yy].filter(Boolean).join(" · ");
}

function fullName(a: FeaturedAlumnusRow): string {
  return [a.first_name, a.last_name].filter(Boolean).join(" ") || "Alumna";
}

function initial(a: FeaturedAlumnusRow): string {
  return (a.first_name?.[0] ?? a.last_name?.[0] ?? "?").toUpperCase();
}

export function EventFeaturedAlumni({
  featured,
}: {
  featured: FeaturedAlumnusRow[];
}) {
  if (featured.length === 0) return null;
  return (
    <section className="my-8 sm:my-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {featured.map((a) => {
          const role = deriveCurrentRole(a);
          const byline = bylineText(a);
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 bg-white border border-[color:var(--rule)] rounded-[10px] p-3"
            >
              <div className="relative w-12 h-12 shrink-0 rounded-full bg-[color:var(--ivory-2)] overflow-hidden flex items-center justify-center text-[color:var(--navy)] text-sm font-bold">
                {a.photo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={a.photo_url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span>{initial(a)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[color:var(--navy-ink)] truncate">
                  {fullName(a)}
                </div>
                {byline && (
                  <div className="text-[12px] text-[color:var(--muted)] truncate">
                    {byline}
                  </div>
                )}
                {role && (
                  <div className="text-[12px] text-[color:var(--navy-ink)] truncate">
                    {role}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
