import Link from "next/link";
import { getSiteSettings } from "@/lib/settings";
import { saveSiteSettings } from "./actions";
import LogoPreview from "./LogoPreview";
import { fmtDate } from "@/lib/admin-time";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.round(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDate(iso);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const s = await getSiteSettings();
  const missingAddress = !s.physical_address || !s.physical_address.trim();

  return (
    <div className="max-w-[760px]">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Email settings</h1>
          <p className="text-[color:var(--muted)] text-sm">
            Branding and default copy used by the newsletter template. Last updated {timeAgo(s.updated_at)}.
          </p>
        </div>
        <Link href="/admin/email/preview" className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white">
          Preview →
        </Link>
      </div>

      {sp.saved && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">Saved.</div>
      )}

      <form action={saveSiteSettings} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 space-y-8">
        <Section title="Branding">
          <Grid>
            <Field label="Logo URL (absolute, for email)" name="logo_url" defaultValue={s.logo_url} placeholder="https://uwcbayarea.org/uwc-logo.png" full />
            <div className="sm:col-span-2">
              <LogoPreview initial={s.logo_url ?? ""} />
            </div>
            <Field label="Footer tagline" name="footer_tagline" defaultValue={s.footer_tagline ?? "A UWC Initiative"} />
            <Field label="Default 'from' name" name="default_from_name" defaultValue={s.default_from_name ?? "UWC Bay Area"} />
            <label className="block sm:col-span-2">
              <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                Physical mailing address (required in newsletter footer for CAN-SPAM compliance)
              </span>
              <textarea
                name="physical_address"
                defaultValue={s.physical_address ?? ""}
                rows={2}
                className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-sans"
                placeholder="339 Dolan Avenue, Mill Valley, CA, 94941"
              />
              {missingAddress && (
                <div className="mt-2 p-2.5 bg-yellow-50 border-l-4 border-yellow-500 text-xs text-yellow-900 rounded-[2px]">
                  No physical address set. Required for real sends; newsletter footer omits it until you add one.
                </div>
              )}
            </label>
          </Grid>
        </Section>

        <Section title="WhatsApp defaults">
          <Grid>
            <Field label="WhatsApp URL (join link)" name="whatsapp_url" defaultValue={s.whatsapp_url} placeholder="https://chat.whatsapp.com/..." full />
            <Field label="Default headline" name="whatsapp_default_headline" defaultValue={s.whatsapp_default_headline} full />
            <Textarea label="Default body" name="whatsapp_default_body" defaultValue={s.whatsapp_default_body} />
            <Field label="Default CTA label" name="whatsapp_default_cta_label" defaultValue={s.whatsapp_default_cta_label} />
          </Grid>
        </Section>

        <Section title="Foodies defaults">
          <Grid>
            <Field label="Default headline" name="foodies_default_headline" defaultValue={s.foodies_default_headline} />
            <Field label="Default CTA label" name="foodies_default_cta_label" defaultValue={s.foodies_default_cta_label} />
            <Textarea label="Default body" name="foodies_default_body" defaultValue={s.foodies_default_body} />
            <Field label="Default CTA URL" name="foodies_default_cta_url" defaultValue={s.foodies_default_cta_url} full placeholder="https://..." />
          </Grid>
        </Section>

        <div className="pt-4 border-t border-[color:var(--rule)]">
          <button type="submit" className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label, name, defaultValue, placeholder, full,
}: {
  label: string; name: string; defaultValue?: string | null; placeholder?: string; full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function Textarea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) {
  return (
    <label className="block sm:col-span-2">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={3}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-sans"
      />
    </label>
  );
}
