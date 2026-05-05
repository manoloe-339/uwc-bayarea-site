import Link from "next/link";
import { WhatsAppIcon } from "@/components/admin/icons/WhatsAppIcon";
import { fmtDateTimeShort } from "@/lib/admin-time";
import { listVisitingRequests, whatsappUrl } from "@/lib/visiting-requests";
import {
  countPendingRegisteredWhatsappRequests,
  listRegisteredWhatsappRequests,
} from "@/lib/whatsapp-requests";
import { DEFAULT_WHATSAPP_INVITE, getSiteSettings } from "@/lib/settings";
import { ensureParagraphBreaks } from "@/lib/signup-confirmation";
import {
  EMAIL_LINK_ATTRS,
  EMAIL_PARAGRAPH_ATTRS,
  renderSimpleMarkdown,
} from "@/lib/simple-markdown";
import { MarkdownTextarea } from "@/components/admin/MarkdownTextarea";
import {
  saveWhatsappTemplateAction,
  sendTestWhatsappTemplateAction,
  sendWhatsappInviteAction,
  toggleVisitingContactedAction,
  unmarkWhatsappInviteSentAction,
} from "./actions";

export const dynamic = "force-dynamic";

type Tab = "requests" | "visiting" | "template";

function pickTab(value: string | undefined): Tab {
  if (value === "visiting" || value === "template") return value;
  return "requests";
}

export default async function WhatsappAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    saved?: string;
    test?: string;
    msg?: string;
  }>;
}) {
  const sp = await searchParams;
  const tab = pickTab(sp.tab);

  const [visiting, registered, settings] = await Promise.all([
    listVisitingRequests(),
    listRegisteredWhatsappRequests(),
    getSiteSettings(),
  ]);
  const pendingVisiting = visiting.filter((r) => !r.contacted_at).length;
  const pendingRegistered = registered.filter((r) => !r.sent_at).length;

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools" className="text-[color:var(--muted)] hover:text-navy">
          ← Tools
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1 flex items-center gap-2">
        <WhatsAppIcon size={28} className="inline-block align-[-4px]" />
        WhatsApp admin
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6 max-w-[640px]">
        Requests for the UWC Bay Area WhatsApp group, both from registered
        alumni and Bay Area visitors, plus the invite email template.
      </p>

      <TabNav
        active={tab}
        counts={{ visiting: pendingVisiting, requests: pendingRegistered }}
      />

      {sp.msg && (
        <div className="mb-4 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          {sp.msg}
        </div>
      )}
      {sp.saved && (
        <div className="mb-4 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          Saved.
        </div>
      )}
      {sp.test === "sent" && (
        <div className="mb-4 p-3 bg-ivory-2 border-l-4 border-emerald-700 rounded-[2px] text-sm">
          Test email sent. Check your inbox.
        </div>
      )}
      {sp.test === "failed" && (
        <div className="mb-4 p-3 bg-rose-50 border-l-4 border-rose-700 rounded-[2px] text-sm text-rose-900">
          Test send failed: {sp.msg ?? "unknown error"}
        </div>
      )}

      {tab === "visiting" && <VisitingTab rows={visiting} />}
      {tab === "requests" && <RequestsTab rows={registered} />}
      {tab === "template" && <TemplateTab settings={settings} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab nav                                                            */
/* ------------------------------------------------------------------ */

function TabNav({
  active,
  counts,
}: {
  active: Tab;
  counts: { visiting: number; requests: number };
}) {
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "requests", label: "Registered", count: counts.requests },
    { key: "visiting", label: "Visiting", count: counts.visiting },
    { key: "template", label: "Email template" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5 mb-6 border-b border-[color:var(--rule)]">
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={`/admin/tools/whatsapp?tab=${t.key}`}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              isActive
                ? "border-navy text-[color:var(--navy-ink)]"
                : "border-transparent text-[color:var(--muted)] hover:text-navy"
            }`}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className="ml-2 text-[10px] tracking-[.18em] uppercase font-bold text-amber-700 align-middle">
                {t.count} pending
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Visiting tab                                                       */
/* ------------------------------------------------------------------ */

function VisitingTab({
  rows,
}: {
  rows: Awaited<ReturnType<typeof listVisitingRequests>>;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
        No visiting requests yet.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const wa = whatsappUrl(r.phone);
        const fullName = `${r.first_name} ${r.last_name}`.trim();
        const contacted = !!r.contacted_at;
        return (
          <li
            key={r.id}
            className={`bg-white border rounded-[10px] p-4 border-[color:var(--rule)] ${
              contacted ? "opacity-70" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[color:var(--navy-ink)]">
                  {fullName}
                  {r.affiliation && (
                    <span className="ml-2 text-xs text-[color:var(--muted)] font-normal">
                      {r.affiliation}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[color:var(--muted)] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <a
                    href={`mailto:${r.email}`}
                    className="hover:text-navy hover:underline"
                  >
                    ✉ {r.email}
                  </a>
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-navy hover:underline"
                    >
                      📱 {r.phone} → wa.me
                    </a>
                  ) : (
                    <span>📱 {r.phone}</span>
                  )}
                </div>
                {r.note && (
                  <div className="text-sm text-[color:var(--navy-ink)] mt-2 whitespace-pre-wrap">
                    {r.note}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="text-[10px] tracking-[.18em] uppercase text-[color:var(--muted)] font-bold">
                  {fmtDateTimeShort(r.created_at)}
                </div>
                <form action={toggleVisitingContactedAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <input
                    type="hidden"
                    name="contacted"
                    value={contacted ? "0" : "1"}
                  />
                  <button
                    type="submit"
                    className={`text-xs font-semibold px-2.5 py-1 rounded ${
                      contacted
                        ? "border border-[color:var(--rule)] text-[color:var(--muted)] hover:text-navy"
                        : "bg-navy text-white hover:opacity-90"
                    }`}
                  >
                    {contacted
                      ? `✓ Contacted ${r.contacted_at ? fmtDateTimeShort(r.contacted_at) : ""}`
                      : "Mark contacted"}
                  </button>
                </form>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Registered alum requests tab                                       */
/* ------------------------------------------------------------------ */

function RequestsTab({
  rows,
}: {
  rows: Awaited<ReturnType<typeof listRegisteredWhatsappRequests>>;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
        No registered-alum WhatsApp requests yet.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const sent = !!r.sent_at;
        const matched = r.alumni_id != null;
        const fullName = matched
          ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.raw_name
          : r.raw_name;
        return (
          <li
            key={r.id}
            className={`bg-white border rounded-[10px] p-4 border-[color:var(--rule)] ${
              sent ? "opacity-70" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-semibold text-[color:var(--navy-ink)] text-base leading-tight">
                  {matched && r.alumni_id ? (
                    <Link
                      href={`/admin/alumni/${r.alumni_id}`}
                      className="hover:text-navy hover:underline"
                    >
                      {fullName}
                    </Link>
                  ) : (
                    fullName
                  )}
                </div>
                {matched ? (
                  <div className="text-xs text-[color:var(--muted)]">
                    {[r.uwc_college, r.grad_year].filter(Boolean).join(" · ")}
                  </div>
                ) : (
                  <div className="text-xs text-amber-700">
                    No unique match. Review manually.
                  </div>
                )}
                {matched && r.email && (
                  <a
                    href={`mailto:${r.email}`}
                    className="text-xs text-[color:var(--muted)] hover:text-navy hover:underline block break-all"
                  >
                    ✉ {r.email}
                  </a>
                )}
                <div className="text-xs text-[color:var(--muted)]">
                  Requested {fmtDateTimeShort(r.created_at)}
                  {r.registered_at && (
                    <>
                      {" · "}Registered {fmtDateTimeShort(r.registered_at)}
                    </>
                  )}
                </div>
                {!matched && (
                  <Link
                    href={`/admin/alumni?q=${encodeURIComponent(r.raw_name)}`}
                    className="text-xs text-navy hover:underline inline-block"
                  >
                    Search directory →
                  </Link>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {sent ? (
                  <form action={unmarkWhatsappInviteSentAction}>
                    <input type="hidden" name="request_id" value={r.id} />
                    <button
                      type="submit"
                      className="text-xs font-semibold px-2.5 py-1 rounded border border-[color:var(--rule)] text-[color:var(--muted)] hover:text-navy"
                      title="Reset so it can be resent"
                    >
                      ✓ Sent {r.sent_at ? fmtDateTimeShort(r.sent_at) : ""} · undo
                    </button>
                  </form>
                ) : matched ? (
                  <form action={sendWhatsappInviteAction}>
                    <input type="hidden" name="request_id" value={r.id} />
                    <button
                      type="submit"
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-navy text-white hover:opacity-90"
                    >
                      Send invite email
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-[color:var(--muted)]">
                    Match to an alum to enable send
                  </span>
                )}
                {sent && (
                  <div className="text-[11px] text-[color:var(--muted)] flex flex-col items-end gap-0.5">
                    {r.invite_bounced_at ? (
                      <span className="text-rose-700 font-semibold">
                        ⚠ Bounced {fmtDateTimeShort(r.invite_bounced_at)}
                      </span>
                    ) : null}
                    {r.invite_clicked_at ? (
                      <span className="text-emerald-700">
                        ↗ Clicked {fmtDateTimeShort(r.invite_clicked_at)}
                      </span>
                    ) : null}
                    {r.invite_opened_at ? (
                      <span className="text-emerald-700">
                        ◉ Opened {fmtDateTimeShort(r.invite_opened_at)}
                      </span>
                    ) : !r.invite_bounced_at ? (
                      <span>Awaiting open…</span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Email template tab                                                 */
/* ------------------------------------------------------------------ */

async function TemplateTab({
  settings,
}: {
  settings: Awaited<ReturnType<typeof getSiteSettings>>;
}) {
  const currentSubject = settings.whatsapp_invite_subject ?? "";
  const currentBodyMd = settings.whatsapp_invite_body_md ?? "";
  const previewMd = currentBodyMd.trim() || DEFAULT_WHATSAPP_INVITE.bodyMd;
  const whatsappUrl = (settings.whatsapp_url ?? "").trim();
  const previewResolvedMd = ensureParagraphBreaks(
    previewMd.replaceAll("{whatsapp_url}", whatsappUrl || "(set whatsapp_url in site settings)"),
  );
  const previewHtml = renderSimpleMarkdown(
    previewResolvedMd,
    EMAIL_LINK_ATTRS,
    EMAIL_PARAGRAPH_ATTRS,
  );

  return (
    <div className="max-w-[820px]">
      <p className="text-[color:var(--muted)] text-sm mb-4 max-w-[640px]">
        The email sent when you click &ldquo;Send invite&rdquo; on a registered
        request. Salutation (&ldquo;Hi {"{firstName}"},&rdquo;) is added
        automatically. Use {`{whatsapp_url}`} to drop in the join link from
        site settings.
      </p>

      <form
        action={saveWhatsappTemplateAction}
        className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 space-y-5"
      >
        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Subject line
          </span>
          <input
            type="text"
            name="subject"
            defaultValue={currentSubject}
            placeholder={DEFAULT_WHATSAPP_INVITE.subject}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
          <span className="block text-xs text-[color:var(--muted)] mt-1">
            Leave blank to use the default: &ldquo;
            {DEFAULT_WHATSAPP_INVITE.subject}&rdquo;.
          </span>
        </label>

        <MarkdownTextarea
          name="body_md"
          label="Message body"
          defaultValue={currentBodyMd || DEFAULT_WHATSAPP_INVITE.bodyMd}
          rows={16}
          hint="Salutation and unsubscribe footer are added automatically. Markdown: blank line for paragraph, **bold**, *italic*, [click here](https://uwcbayarea.org/whatsapp-guidelines). Placeholder: {whatsapp_url} substitutes the WhatsApp join link from site settings."
        />

        <div className="flex flex-wrap gap-3 pt-3 border-t border-[color:var(--rule)]">
          <button
            type="submit"
            formAction={saveWhatsappTemplateAction}
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide"
          >
            Save changes
          </button>
          <button
            type="submit"
            formAction={sendTestWhatsappTemplateAction}
            className="bg-white border border-[color:var(--rule)] text-navy px-5 py-2.5 rounded text-sm font-semibold tracking-wide hover:border-navy"
          >
            Send test to manoloe@gmail.com
          </button>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
          Preview (currently saved version)
        </h2>
        <div className="bg-[#F4EFE3] p-6 rounded-[10px] border border-[color:var(--rule)]">
          <div
            className="bg-white rounded-[10px] mx-auto p-7 text-[15px] leading-[1.55] text-[color:var(--navy-ink)] [&_a]:text-[#0265A8] [&_a]:underline"
            style={{ maxWidth: 560, border: "1px solid rgba(11,37,69,0.16)" }}
          >
            <p className="mb-4">Hi {"{firstName}"},</p>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            <div className="mt-6 pt-4 border-t border-[color:var(--rule)] text-xs text-[color:var(--muted)]">
              You&rsquo;re receiving this because you&rsquo;re part of the UWC
              Bay Area alumni network.
              <br />
              <span className="text-[#0265A8] underline">Unsubscribe</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
