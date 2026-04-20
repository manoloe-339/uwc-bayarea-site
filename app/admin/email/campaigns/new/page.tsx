import { getSiteSettings } from "@/lib/settings";
import { emptyDraft, type CampaignDraft } from "@/lib/campaign-content";
import { countFilteredRecipients } from "@/lib/recipients";
import ComposeForm from "../ComposeForm";
import type { AlumniFilters } from "@/lib/alumni-query";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };

function pickStr(sp: SP, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}
function pickNum(sp: SP, key: string): number | undefined {
  const s = pickStr(sp, key);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const rawIds = sp["ids"];
  const idList = (Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [])
    .flatMap((v) => String(v).split(","))
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  const filters: AlumniFilters =
    idList.length > 0
      ? { ids: idList, subscription: "subscribed" }
      : {
          q: pickStr(sp, "q"),
          college: pickStr(sp, "college"),
          region: pickStr(sp, "region"),
          origin: pickStr(sp, "origin"),
          city: pickStr(sp, "city"),
          yearFrom: pickNum(sp, "yearFrom"),
          yearTo: pickNum(sp, "yearTo"),
          help: pickStr(sp, "help"),
          includeNonAlums: pickStr(sp, "includeNonAlums") === "1",
          includeMovedOut: pickStr(sp, "includeMovedOut") === "1",
          subscription: "subscribed",
        };

  const draft: CampaignDraft = { ...emptyDraft(), filters };

  const [recipientsResult, settings] = await Promise.all([
    (async () => {
      try {
        return await import("@/lib/recipients").then((m) => m.getFilteredRecipients(filters));
      } catch {
        return { list: [], count: 0, deduped: 0, skipped: 0 };
      }
    })(),
    getSiteSettings(),
  ]);
  const { list, count } = recipientsResult;
  const preview = list.slice(0, 20).map((r) => ({
    id: r.id,
    name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
    email: r.email,
  }));

  return (
    <div>
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-5">New campaign</h1>
      <ComposeForm
        initial={draft}
        recipientCount={count}
        recipientPreview={preview}
        settings={{
          logoUrl: settings.logo_url ?? undefined,
          physicalAddress: settings.physical_address ?? undefined,
          footerTagline: settings.footer_tagline ?? undefined,
          whatsappDefaultHeadline: settings.whatsapp_default_headline ?? undefined,
          whatsappDefaultBody: settings.whatsapp_default_body ?? undefined,
          whatsappDefaultCtaLabel: settings.whatsapp_default_cta_label ?? undefined,
          whatsappDefaultUrl: settings.whatsapp_url ?? undefined,
          foodiesDefaultHeadline: settings.foodies_default_headline ?? undefined,
          foodiesDefaultBody: settings.foodies_default_body ?? undefined,
          foodiesDefaultCtaLabel: settings.foodies_default_cta_label ?? undefined,
          foodiesDefaultCtaUrl: settings.foodies_default_cta_url ?? "https://uwcbayarea.org",
        }}
      />
      {/* silence unused import */}
      {false ? countFilteredRecipients(filters).then(() => null) : null}
    </div>
  );
}
