import { sql } from "@/lib/db";
import { COLLEGES } from "@/lib/uwc-colleges";
import { type UwcSlot } from "./actions";
import UwcSlotCard from "./UwcSlotCard";

export const dynamic = "force-dynamic";

type Row = {
  canonical: string;
  logo_url: string | null;
  campus_url: string | null;
  other_url: string | null;
};

const SLOTS: Array<{ key: UwcSlot; label: string; help: string }> = [
  { key: "logo", label: "Logo", help: "Square mark, clean background." },
  { key: "campus", label: "Campus photo", help: "Wide shot of campus or grounds." },
  { key: "other", label: "Other photo", help: "Anything else — students, classroom, signage." },
];

export default async function UwcAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const errorMessage = typeof sp.error === "string" ? sp.error : null;
  const rows = (await sql`
    SELECT canonical, logo_url, campus_url, other_url FROM uwc_assets
  `) as Row[];
  const byCanonical = new Map(rows.map((r) => [r.canonical, r]));

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-[color:var(--navy-ink)]">
        UWC assets
      </h1>
      <p className="text-[color:var(--muted)] mt-2 text-sm leading-relaxed max-w-prose">
        Curated logo + campus + extra-photo slots for each of the 19 UWC schools.
        These feed the animated <code>/directory/login</code> backdrop. Upload
        replaces the previous file. Each filled slot has a Crop / zoom button
        for adjusting framing per photo.
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800"
        >
          <strong className="font-bold">Upload failed:</strong> {errorMessage}
        </div>
      )}

      <div className="mt-8 space-y-4">
        {COLLEGES.map((c) => {
          const row = byCanonical.get(c.canonical);
          return (
            <div
              key={c.canonical}
              className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5"
            >
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-bold text-[color:var(--navy-ink)]">
                  {c.canonical}
                </h2>
                <span className="text-xs text-[color:var(--muted)]">
                  {c.country}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SLOTS.map((slot) => {
                  const url =
                    slot.key === "logo"
                      ? row?.logo_url
                      : slot.key === "campus"
                        ? row?.campus_url
                        : row?.other_url;
                  return (
                    <UwcSlotCard
                      key={slot.key}
                      canonical={c.canonical}
                      slot={slot.key}
                      label={slot.label}
                      help={slot.help}
                      url={url ?? null}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
