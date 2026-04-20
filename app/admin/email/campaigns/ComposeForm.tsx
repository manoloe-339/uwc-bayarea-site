"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { render } from "@react-email/render";
import Link from "next/link";
import AlumniNewsletter, {
  type AlumniNewsletterProps,
} from "@/emails/AlumniNewsletter";
import type { CampaignDraft } from "@/lib/campaign-content";
import type { AlumniFilters } from "@/lib/alumni-query";
import { COLLEGES } from "@/lib/uwc-colleges";
import { REGIONS } from "@/lib/region";
import {
  saveDraftAction,
  deleteCampaign,
  cancelScheduled,
  sendTestAction,
  sendNowAction,
  scheduleAction,
} from "./actions";

type PreviewSettings = {
  logoUrl?: string;
  physicalAddress?: string;
  footerTagline?: string;
  whatsappDefaultHeadline?: string;
  whatsappDefaultBody?: string;
  whatsappDefaultCtaLabel?: string;
  whatsappDefaultUrl?: string;
  foodiesDefaultHeadline?: string;
  foodiesDefaultBody?: string;
  foodiesDefaultCtaLabel?: string;
  foodiesDefaultCtaUrl?: string;
};

type RecipientPreviewEntry = {
  id: number;
  name: string;
  email: string;
  firstName?: string | null;
};

export default function ComposeForm({
  initial,
  settings,
  recipientCount,
  recipientPreview,
}: {
  initial: CampaignDraft;
  settings: PreviewSettings;
  recipientCount: number;
  recipientPreview?: RecipientPreviewEntry[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CampaignDraft>(initial);
  const [saving, startSave] = useTransition();
  const [pending, startPending] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [sendResult, setSendResult] = useState<string | null>(null);
  const isNew = !initial.id;
  const isLocked =
    draft.status === "sending" ||
    draft.status === "sent" ||
    draft.status === "cancelled";

  // Warn on navigating away with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function patch<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  function save() {
    startSave(async () => {
      const { id } = await saveDraftAction(draft);
      setSavedAt(new Date().toLocaleTimeString());
      setDirty(false);
      if (isNew) router.replace(`/admin/email/campaigns/${id}/edit`);
      router.refresh();
    });
  }

  function sendTest() {
    setTestMsg(null);
    startPending(async () => {
      const result = await sendTestAction({ draft, toEmail: testTo });
      if (result.ok) {
        setTestMsg(`Test sent to ${testTo}.`);
        setDirty(false);
        setSavedAt(new Date().toLocaleTimeString());
      } else {
        setTestMsg(`Error: ${result.error}`);
      }
    });
  }

  function openConfirm() {
    setSendResult(null);
    setConfirmText("");
    setConfirmOpen(true);
  }

  function sendNow() {
    startPending(async () => {
      const result = await sendNowAction({ draft });
      if (result.ok) {
        setSendResult(
          `Sent: ${result.sent} · Failed: ${result.failed} · Recipients: ${result.recipients}`
        );
        setConfirmOpen(false);
        setDirty(false);
        if (result.id && isNew) router.replace(`/admin/email/campaigns/${result.id}`);
        else if (result.id) router.push(`/admin/email/campaigns/${result.id}`);
      } else {
        setSendResult(`Error: ${result.error}`);
      }
    });
  }

  function schedule() {
    setTestMsg(null);
    startPending(async () => {
      const result = await scheduleAction({ draft });
      if (result.ok) {
        setDirty(false);
        // Send the admin to the campaigns list so the scheduled campaign is
        // surfaced among its peers with its "Scheduled <date>" row.
        router.push("/admin/email/campaigns");
        router.refresh();
      } else {
        setTestMsg(`Error: ${result.error}`);
      }
    });
  }

  const previewFirstName =
    (recipientPreview?.[0]?.firstName ?? "").trim() || "Sarah";

  const previewProps = useMemo<AlumniNewsletterProps | null>(() => {
    if (draft.format !== "newsletter") return null;
    const nl = draft.newsletter;
    if (!nl) return null;
    return {
      logoUrl: settings.logoUrl,
      physicalAddress: settings.physicalAddress,
      footerTagline: settings.footerTagline,
      recipientFirstName: previewFirstName,
      unsubscribeUrl: "https://uwcbayarea.org/unsubscribe?token=PREVIEW",
      preheader: draft.preheader || undefined,
      mode: nl.mode,
      announcementKicker: nl.announcementKicker,
      reminderTag: nl.mode === "reminder" ? (nl.reminderTag ?? "This Saturday!") : undefined,
      event: nl.mode !== "update" ? nl.event : undefined,
      update: nl.mode === "update" ? nl.update : undefined,
      whatsNext: nl.whatsNext?.show && nl.whatsNext.title ? nl.whatsNext : undefined,
      whatsapp: nl.whatsapp?.show
        ? {
            show: true,
            headline: nl.whatsapp.headline ?? settings.whatsappDefaultHeadline,
            body: nl.whatsapp.body ?? settings.whatsappDefaultBody,
            imageUrl: nl.whatsapp.imageUrl,
            imageAlt: nl.whatsapp.imageAlt,
            imageCaption: nl.whatsapp.imageCaption,
            ctaLabel: nl.whatsapp.ctaLabel ?? settings.whatsappDefaultCtaLabel,
            ctaUrl: nl.whatsapp.ctaUrl ?? settings.whatsappDefaultUrl ?? "https://uwcbayarea.org",
          }
        : undefined,
      foodies: nl.foodies?.show
        ? {
            show: true,
            headline: nl.foodies.headline ?? settings.foodiesDefaultHeadline,
            body: nl.foodies.body ?? settings.foodiesDefaultBody,
            imageUrl: nl.foodies.imageUrl,
            imageAlt: nl.foodies.imageAlt,
            imageCaption: nl.foodies.imageCaption,
            ctaLabel: nl.foodies.ctaLabel ?? settings.foodiesDefaultCtaLabel,
            ctaUrl: nl.foodies.ctaUrl ?? settings.foodiesDefaultCtaUrl,
          }
        : undefined,
    };
  }, [draft, settings]);

  const [previewHtml, setPreviewHtml] = useState("<p>rendering…</p>");
  useEffect(() => {
    if (!previewProps) {
      setPreviewHtml(quickNoteHtml(draft, settings, previewFirstName));
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      Promise.resolve(render(<AlumniNewsletter {...previewProps} />))
        .then((h) => !cancelled && setPreviewHtml(typeof h === "string" ? h : ""))
        .catch((e) => !cancelled && setPreviewHtml(`<pre style="padding:16px;color:#b91c1c">${(e as Error).message}</pre>`));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [previewProps, draft, settings]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_560px]">
      {/* --- Form column --- */}
      <div className="space-y-6">
        <FormCard title="Format">
          <div className="flex gap-2">
            {(["quick_note", "newsletter"] as const).map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => patch("format", f)}
                disabled={isLocked}
                className={`flex-1 px-4 py-2 text-sm font-semibold rounded border ${
                  draft.format === f
                    ? "bg-navy text-white border-navy"
                    : "border-[color:var(--rule)] text-[color:var(--navy-ink)]"
                }`}
              >
                {f === "quick_note" ? "Quick note" : "Newsletter"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            <strong>Quick note:</strong> plain text body, simple footer. Use for short updates.
            <br />
            <strong>Newsletter:</strong> full template with hero image, sections, etc.
          </p>
        </FormCard>

        <FormCard title="Meta">
          <Field
            label="Subject"
            value={draft.subject}
            onChange={(v) => patch("subject", v)}
            disabled={isLocked}
            hint="Personalization available: {{firstName}}"
          />
          {draft.format === "newsletter" && (
            <Field
              label="Preheader (inbox-preview text, optional)"
              value={draft.preheader}
              onChange={(v) => patch("preheader", v)}
              disabled={isLocked}
            />
          )}
          <Field
            label={`From name (optional; defaults to "UWC Bay Area")`}
            value={draft.fromName}
            onChange={(v) => patch("fromName", v)}
            disabled={isLocked}
          />
        </FormCard>

        {draft.format === "quick_note" ? (
          <QuickNoteSection draft={draft} setDraft={setDraft} setDirty={setDirty} disabled={isLocked} />
        ) : (
          <NewsletterSection draft={draft} setDraft={setDraft} setDirty={setDirty} disabled={isLocked} />
        )}

        <RecipientsCard
          filters={draft.filters}
          recipientCount={recipientCount}
          recipientPreview={recipientPreview}
          disabled={isLocked}
        />

        <ScheduleCard
          sendMode={draft.sendMode}
          scheduledFor={draft.scheduledFor}
          onChangeSendMode={(v) => patch("sendMode", v)}
          onChangeDate={(v) => patch("scheduledFor", v)}
          disabled={isLocked}
        />

        {/* Test-send strip */}
        {!isLocked && (
          <FormCard title="Send test">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="email"
                placeholder="you@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                className="flex-1 min-w-[220px] border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
              />
              <button
                type="button"
                onClick={sendTest}
                disabled={pending || !testTo || !draft.subject.trim()}
                className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send test"}
              </button>
            </div>
            {testMsg && (
              <p className={`mt-2 text-xs ${testMsg.startsWith("Error") ? "text-red-700" : "text-green-700"}`}>
                {testMsg}
              </p>
            )}
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              If the test email matches a recipient, uses their real first name; otherwise uses the first recipient's (or "Sarah" if the list is empty). Subject is prefixed <code>[TEST]</code>.
            </p>
          </FormCard>
        )}

        <div className="sticky bottom-0 z-10 bg-ivory border-t border-[color:var(--rule)] py-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !draft.subject.trim() || isLocked}
            className="bg-white border border-navy text-navy px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : savedAt && !dirty ? `Saved at ${savedAt}` : "Save draft"}
          </button>

          {!isLocked && draft.sendMode === "now" && (
            <button
              type="button"
              onClick={openConfirm}
              disabled={pending || !draft.subject.trim() || recipientCount === 0}
              className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
              title={recipientCount === 0 ? "No recipients" : `Send to ${recipientCount}`}
            >
              Send now →
            </button>
          )}

          {!isLocked && draft.sendMode === "scheduled" && (
            <button
              type="button"
              onClick={schedule}
              disabled={pending || !draft.subject.trim() || !draft.scheduledFor}
              className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Scheduling…" : "Schedule →"}
            </button>
          )}

          {draft.status === "scheduled" && draft.id && (
            <button
              type="button"
              onClick={async () => {
                if (confirm("Cancel this scheduled send?") && draft.id) {
                  await cancelScheduled(draft.id);
                  router.refresh();
                }
              }}
              className="text-sm text-red-700 hover:underline"
            >
              Cancel scheduled send
            </button>
          )}

          {draft.status === "draft" && draft.id && (
            <button
              type="button"
              onClick={async () => {
                if (confirm("Delete this draft? This cannot be undone.") && draft.id) {
                  await deleteCampaign(draft.id);
                }
              }}
              className="text-sm text-red-700 hover:underline"
            >
              Delete draft
            </button>
          )}

          <span className="ml-auto text-xs text-[color:var(--muted)]">
            {dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt}` : "—"}
          </span>

          <Link
            href="/admin/email/campaigns"
            className="text-sm text-[color:var(--muted)] hover:text-navy"
          >
            ← Campaigns
          </Link>
        </div>

        {sendResult && !confirmOpen && (
          <p
            className={`text-sm ${sendResult.startsWith("Error") ? "text-red-700" : "text-green-700"}`}
          >
            {sendResult}
          </p>
        )}

        {confirmOpen && (
          <ConfirmSendModal
            subject={draft.subject}
            recipientCount={recipientCount}
            format={draft.format}
            confirmText={confirmText}
            setConfirmText={setConfirmText}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={sendNow}
            pending={pending}
            error={sendResult && sendResult.startsWith("Error") ? sendResult : null}
          />
        )}
      </div>

      {/* --- Preview column --- */}
      <div className="lg:sticky lg:top-4 self-start">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">Preview</span>
          <span className="text-xs text-[color:var(--muted)]">
            {draft.format === "newsletter" ? "Newsletter · 600px" : "Quick note"}
          </span>
        </div>
        <iframe
          srcDoc={previewHtml}
          title="email preview"
          style={{
            width: "100%",
            height: "720px",
            background: "#ffffff",
            border: "1px solid rgba(11,37,69,0.16)",
            borderRadius: "10px",
          }}
        />
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Preview shows <code>{previewFirstName}</code>{recipientPreview?.[0]?.firstName ? " (first recipient's first name)" : " (placeholder — no recipients yet)"}. Real sends personalize per recipient.
        </p>
      </div>
    </div>
  );
}

// ---------- Sub-forms ----------

function QuickNoteSection({
  draft, setDraft, setDirty, disabled,
}: {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
  disabled: boolean;
}) {
  const qn = draft.quickNote ?? { body: "", salutation: "Hi", includeFirstName: true };
  function update(patch: Partial<typeof qn>) {
    setDraft((d) => ({ ...d, quickNote: { ...qn, ...patch } }));
    setDirty(true);
  }
  return (
    <FormCard title="Body">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end mb-4">
        <Field
          label="Salutation"
          value={qn.salutation}
          onChange={(v) => update({ salutation: v })}
          disabled={disabled}
        />
        <label className="flex items-center gap-2 text-sm text-[color:var(--navy-ink)] pb-2.5">
          <input
            type="checkbox"
            checked={qn.includeFirstName}
            onChange={(e) => update({ includeFirstName: e.target.checked })}
            disabled={disabled}
          />
          Include first name
        </label>
      </div>
      <Textarea
        label="Body"
        rows={14}
        value={qn.body}
        onChange={(v) => update({ body: v })}
        disabled={disabled}
        hint="Plain text — line breaks preserved, URLs auto-linked. Supports {{firstName}}."
      />
    </FormCard>
  );
}

function NewsletterSection({
  draft, setDraft, setDirty, disabled,
}: {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
  disabled: boolean;
}) {
  const nl = draft.newsletter ?? {
    mode: "announcement" as const,
    event: { title: "" },
    whatsNext: { show: true, title: "" },
    whatsapp: { show: true },
    foodies: { show: true },
  };
  function update(patch: Partial<typeof nl>) {
    setDraft((d) => ({ ...d, newsletter: { ...nl, ...patch } }));
    setDirty(true);
  }
  const event = nl.event ?? { title: "" };
  const update_ = nl.update ?? { headline: "", body: "" };

  return (
    <>
      <FormCard title="Mode">
        <div className="flex flex-wrap gap-2">
          {(["announcement", "reminder", "update"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => update({ mode: m })}
              disabled={disabled}
              className={`px-4 py-2 text-sm font-semibold rounded border capitalize ${
                nl.mode === m
                  ? "bg-navy text-white border-navy"
                  : "border-[color:var(--rule)] text-[color:var(--navy-ink)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </FormCard>

      {nl.mode !== "update" ? (
        <FormCard title={nl.mode === "reminder" ? "Reminder" : "Event"}>
          {nl.mode === "announcement" && (
            <Field
              label={`Announcement kicker (default: "Save the date")`}
              value={nl.announcementKicker ?? ""}
              onChange={(v) => update({ announcementKicker: v })}
              disabled={disabled}
            />
          )}
          {nl.mode === "reminder" && (
            <Field
              label="Reminder tag (big hero headline, e.g. “This Saturday!”)"
              value={nl.reminderTag ?? ""}
              onChange={(v) => update({ reminderTag: v })}
              disabled={disabled}
            />
          )}
          <Field
            label="Hero headline (announcement; magazine deck)"
            value={event.heroHeadline ?? ""}
            onChange={(v) => update({ event: { ...event, heroHeadline: v } })}
            disabled={disabled}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Image URL"
              value={event.imageUrl ?? ""}
              onChange={(v) => update({ event: { ...event, imageUrl: v } })}
              disabled={disabled}
              hint="Absolute URL, hosted somewhere stable"
            />
            <Field
              label="Image alt text"
              value={event.imageAlt ?? ""}
              onChange={(v) => update({ event: { ...event, imageAlt: v } })}
              disabled={disabled}
            />
          </div>
          <Field
            label="Event title"
            value={event.title}
            onChange={(v) => update({ event: { ...event, title: v } })}
            disabled={disabled}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Dateline (e.g. Friday May 1, 6:30 PM)"
              value={event.dateline ?? ""}
              onChange={(v) => update({ event: { ...event, dateline: v } })}
              disabled={disabled}
            />
            <Field
              label="Location"
              value={event.location ?? ""}
              onChange={(v) => update({ event: { ...event, location: v } })}
              disabled={disabled}
            />
          </div>
          <Field
            label="Location note"
            value={event.locationNote ?? ""}
            onChange={(v) => update({ event: { ...event, locationNote: v } })}
            disabled={disabled}
          />
          <Textarea
            label="Description"
            value={event.description ?? ""}
            onChange={(v) => update({ event: { ...event, description: v } })}
            disabled={disabled}
            rows={4}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="CTA label (e.g. Get tickets · $10)"
              value={event.cta?.label ?? ""}
              onChange={(v) =>
                update({ event: { ...event, cta: { label: v, url: event.cta?.url ?? "" } } })
              }
              disabled={disabled}
            />
            <Field
              label="CTA URL"
              value={event.cta?.url ?? ""}
              onChange={(v) =>
                update({ event: { ...event, cta: { label: event.cta?.label ?? "", url: v } } })
              }
              disabled={disabled}
            />
          </div>
        </FormCard>
      ) : (
        <FormCard title="Update content">
          <Field
            label="Headline"
            value={update_.headline}
            onChange={(v) => update({ update: { ...update_, headline: v } })}
            disabled={disabled}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Image URL"
              value={update_.imageUrl ?? ""}
              onChange={(v) => update({ update: { ...update_, imageUrl: v } })}
              disabled={disabled}
            />
            <Field
              label="Image alt"
              value={update_.imageAlt ?? ""}
              onChange={(v) => update({ update: { ...update_, imageAlt: v } })}
              disabled={disabled}
            />
          </div>
          <Field
            label="Image caption"
            value={update_.imageCaption ?? ""}
            onChange={(v) => update({ update: { ...update_, imageCaption: v } })}
            disabled={disabled}
          />
          <Textarea
            label="Body"
            value={update_.body}
            onChange={(v) => update({ update: { ...update_, body: v } })}
            disabled={disabled}
            rows={7}
            hint="Paragraphs separated by blank lines. Supports {{firstName}}."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="CTA label (optional)"
              value={update_.cta?.label ?? ""}
              onChange={(v) =>
                update({ update: { ...update_, cta: { label: v, url: update_.cta?.url ?? "" } } })
              }
              disabled={disabled}
            />
            <Field
              label="CTA URL (optional)"
              value={update_.cta?.url ?? ""}
              onChange={(v) =>
                update({ update: { ...update_, cta: { label: update_.cta?.label ?? "", url: v } } })
              }
              disabled={disabled}
            />
          </div>
        </FormCard>
      )}

      {/* Persistent sections */}
      <FormCard title="What's next">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={nl.whatsNext?.show ?? true}
            onChange={(e) =>
              update({
                whatsNext: { ...(nl.whatsNext ?? { title: "" }), show: e.target.checked },
              })
            }
            disabled={disabled}
          />
          Show this section
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Tag (e.g. Foodies)"
            value={nl.whatsNext?.tag ?? ""}
            onChange={(v) => update({ whatsNext: { ...(nl.whatsNext ?? { show: true, title: "" }), tag: v } })}
            disabled={disabled}
          />
          <Field
            label="Title"
            value={nl.whatsNext?.title ?? ""}
            onChange={(v) => update({ whatsNext: { ...(nl.whatsNext ?? { show: true, title: "" }), title: v } })}
            disabled={disabled}
          />
          <Field
            label="Dateline"
            value={nl.whatsNext?.dateline ?? ""}
            onChange={(v) => update({ whatsNext: { ...(nl.whatsNext ?? { show: true, title: "" }), dateline: v } })}
            disabled={disabled}
          />
          <Field
            label="Image URL"
            value={nl.whatsNext?.imageUrl ?? ""}
            onChange={(v) => update({ whatsNext: { ...(nl.whatsNext ?? { show: true, title: "" }), imageUrl: v } })}
            disabled={disabled}
          />
        </div>
        <Textarea
          label="Description"
          value={nl.whatsNext?.description ?? ""}
          onChange={(v) => update({ whatsNext: { ...(nl.whatsNext ?? { show: true, title: "" }), description: v } })}
          disabled={disabled}
          rows={3}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="CTA label"
            value={nl.whatsNext?.cta?.label ?? ""}
            onChange={(v) => update({
              whatsNext: { ...(nl.whatsNext ?? { show: true, title: "" }), cta: { label: v, url: nl.whatsNext?.cta?.url ?? "" } },
            })}
            disabled={disabled}
          />
          <Field
            label="CTA URL"
            value={nl.whatsNext?.cta?.url ?? ""}
            onChange={(v) => update({
              whatsNext: { ...(nl.whatsNext ?? { show: true, title: "" }), cta: { label: nl.whatsNext?.cta?.label ?? "", url: v } },
            })}
            disabled={disabled}
          />
        </div>
      </FormCard>

      <FormCard title="WhatsApp (optional overrides; blank = use Settings defaults)">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={nl.whatsapp?.show ?? true}
            onChange={(e) =>
              update({ whatsapp: { ...(nl.whatsapp ?? { show: true }), show: e.target.checked } })
            }
            disabled={disabled}
          />
          Show this section
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Override headline"
            value={nl.whatsapp?.headline ?? ""}
            onChange={(v) => update({ whatsapp: { ...(nl.whatsapp ?? { show: true }), headline: v } })}
            disabled={disabled}
          />
          <Field
            label="Override CTA label"
            value={nl.whatsapp?.ctaLabel ?? ""}
            onChange={(v) => update({ whatsapp: { ...(nl.whatsapp ?? { show: true }), ctaLabel: v } })}
            disabled={disabled}
          />
          <Field
            label="Override CTA URL"
            value={nl.whatsapp?.ctaUrl ?? ""}
            onChange={(v) => update({ whatsapp: { ...(nl.whatsapp ?? { show: true }), ctaUrl: v } })}
            disabled={disabled}
          />
          <Field
            label="Image URL"
            value={nl.whatsapp?.imageUrl ?? ""}
            onChange={(v) => update({ whatsapp: { ...(nl.whatsapp ?? { show: true }), imageUrl: v } })}
            disabled={disabled}
          />
        </div>
        <Textarea
          label="Override body"
          value={nl.whatsapp?.body ?? ""}
          onChange={(v) => update({ whatsapp: { ...(nl.whatsapp ?? { show: true }), body: v } })}
          disabled={disabled}
          rows={3}
        />
      </FormCard>

      <FormCard title="Foodies (optional overrides; blank = Settings defaults)">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={nl.foodies?.show ?? true}
            onChange={(e) =>
              update({ foodies: { ...(nl.foodies ?? { show: true }), show: e.target.checked } })
            }
            disabled={disabled}
          />
          Show this section
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Override headline"
            value={nl.foodies?.headline ?? ""}
            onChange={(v) => update({ foodies: { ...(nl.foodies ?? { show: true }), headline: v } })}
            disabled={disabled}
          />
          <Field
            label="Override CTA label"
            value={nl.foodies?.ctaLabel ?? ""}
            onChange={(v) => update({ foodies: { ...(nl.foodies ?? { show: true }), ctaLabel: v } })}
            disabled={disabled}
          />
          <Field
            label="Override CTA URL"
            value={nl.foodies?.ctaUrl ?? ""}
            onChange={(v) => update({ foodies: { ...(nl.foodies ?? { show: true }), ctaUrl: v } })}
            disabled={disabled}
          />
          <Field
            label="Image URL"
            value={nl.foodies?.imageUrl ?? ""}
            onChange={(v) => update({ foodies: { ...(nl.foodies ?? { show: true }), imageUrl: v } })}
            disabled={disabled}
          />
        </div>
        <Textarea
          label="Override body"
          value={nl.foodies?.body ?? ""}
          onChange={(v) => update({ foodies: { ...(nl.foodies ?? { show: true }), body: v } })}
          disabled={disabled}
          rows={3}
        />
      </FormCard>
    </>
  );
}

function RecipientsCard({
  filters,
  recipientCount,
  recipientPreview,
  disabled: _disabled,
}: {
  filters: AlumniFilters;
  recipientCount: number;
  recipientPreview?: RecipientPreviewEntry[];
  disabled: boolean;
}) {
  const chips: string[] = [];
  if (filters.ids?.length) chips.push(`${filters.ids.length} hand-picked`);
  if (filters.q) chips.push(`search: "${filters.q}"`);
  if (filters.college) chips.push(`College: ${filters.college}`);
  if (filters.region) chips.push(`Region: ${filters.region}`);
  if (filters.city) chips.push(`City: ${filters.city}`);
  if (filters.origin) chips.push(`Origin: ${filters.origin}`);
  if (filters.yearFrom) chips.push(`Grad yr ≥ ${filters.yearFrom}`);
  if (filters.yearTo) chips.push(`Grad yr ≤ ${filters.yearTo}`);
  if (filters.help) chips.push(`Help: ${filters.help}`);
  if (filters.includeNonAlums) chips.push("+ friends/parents");
  if (filters.includeMovedOut) chips.push("+ moved out");
  const preview = recipientPreview ?? [];
  const remainder = Math.max(0, recipientCount - preview.length);
  return (
    <FormCard title="Recipients">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
          {recipientCount.toLocaleString()} recipient{recipientCount === 1 ? "" : "s"}
        </div>
        <div className="text-xs text-[color:var(--muted)]">Excludes unsubscribed and hard-bounced.</div>
      </div>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="text-[11px] text-[color:var(--navy-ink)] bg-ivory-2 border border-[color:var(--rule)] rounded-full px-2.5 py-0.5"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {preview.length > 0 && (
        <ul className="mt-3 divide-y divide-[color:var(--rule)] border border-[color:var(--rule)] rounded text-sm">
          {preview.map((r) => (
            <li key={r.id} className="flex justify-between gap-3 px-3 py-2">
              <Link
                href={`/admin/alumni/${r.id}`}
                className="text-navy hover:underline truncate max-w-[50%]"
              >
                {r.name}
              </Link>
              <span className="text-[color:var(--muted)] truncate max-w-[50%] text-right">
                {r.email}
              </span>
            </li>
          ))}
          {remainder > 0 && (
            <li className="px-3 py-2 text-xs text-[color:var(--muted)] italic">
              …and {remainder.toLocaleString()} more
            </li>
          )}
        </ul>
      )}

      <p className="mt-3 text-xs text-[color:var(--muted)]">
        Filters come from the Alumni search page. To change recipients, go to{" "}
        <Link href="/admin/alumni" className="text-navy underline">
          Alumni
        </Link>{" "}
        → apply filters or tick rows → "Send to selected →". That carries the filter into a new campaign.
      </p>
    </FormCard>
  );
}

function ScheduleCard({
  sendMode, scheduledFor, onChangeSendMode, onChangeDate, disabled,
}: {
  sendMode: "now" | "scheduled";
  scheduledFor?: string;
  onChangeSendMode: (v: "now" | "scheduled") => void;
  onChangeDate: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <FormCard title="Schedule">
      <div className="space-y-2 mb-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="sendMode"
            checked={sendMode === "now"}
            onChange={() => onChangeSendMode("now")}
            disabled={disabled}
          />
          Send now (triggered from this screen — next step)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="sendMode"
            checked={sendMode === "scheduled"}
            onChange={() => onChangeSendMode("scheduled")}
            disabled={disabled}
          />
          Schedule for later
        </label>
      </div>
      {sendMode === "scheduled" && (
        <div>
          <input
            type="datetime-local"
            value={scheduledFor ? toLocalInput(scheduledFor) : ""}
            onChange={(e) => onChangeDate(new Date(e.target.value).toISOString())}
            disabled={disabled}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Local timezone; stored as UTC. Cron runs every 5 minutes and picks up due campaigns.
          </p>
        </div>
      )}
    </FormCard>
  );
}

// ---------- UI primitives ----------

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
      <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label, value, onChange, disabled, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
      </span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white disabled:bg-ivory-2"
      />
      {hint && <span className="block mt-1 text-xs text-[color:var(--muted)]">{hint}</span>}
    </label>
  );
}

function Textarea({
  label, value, onChange, disabled, rows = 4, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
      </span>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-sans disabled:bg-ivory-2"
      />
      {hint && <span className="block mt-1 text-xs text-[color:var(--muted)]">{hint}</span>}
    </label>
  );
}

function quickNoteHtml(draft: CampaignDraft, settings: PreviewSettings, firstName: string): string {
  const body = draft.quickNote?.body ?? "";
  const sal = draft.quickNote?.salutation?.trim();
  const include = draft.quickNote?.includeFirstName;
  const prefix = sal ? `${sal}${include ? ` ${firstName}` : ""},\n\n` : "";
  const full = prefix + body;
  const html = full
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#0265A8;">${u}</a>`)
    .replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4EFE3;font-family:system-ui,sans-serif;color:#0B2545;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border:1px solid rgba(11,37,69,0.16);border-radius:10px;padding:28px 32px;font-size:16px;line-height:1.55;">
        ${html || "<em style=\"color:#888\">Body is empty.</em>"}
        <hr style="border:none;border-top:1px solid rgba(11,37,69,0.12);margin:18px 0 12px;" />
        <div style="font-size:12px;color:rgba(11,37,69,0.62);">
          You're receiving this because you're part of the UWC Bay Area alumni network.<br>
          <a href="#" style="color:#0265A8;">Unsubscribe</a>
        </div>
      </div>
    </div>
  </body></html>`;
}

function ConfirmSendModal({
  subject, recipientCount, format, confirmText, setConfirmText,
  onCancel, onConfirm, pending, error,
}: {
  subject: string;
  recipientCount: number;
  format: "quick_note" | "newsletter";
  confirmText: string;
  setConfirmText: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: string | null;
}) {
  const expected = `SEND ${recipientCount}`;
  const matches = confirmText.trim() === expected;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-[10px] border border-[color:var(--rule)] w-full max-w-md p-6 shadow-xl">
        <h2 className="font-sans text-xl font-bold text-[color:var(--navy-ink)] mb-2">
          Send campaign now?
        </h2>
        <p className="text-sm text-[color:var(--muted)] mb-4">
          This is the real send. You cannot recall it once it leaves.
        </p>
        <dl className="text-sm border border-[color:var(--rule)] rounded p-3 mb-4 space-y-1">
          <div className="flex justify-between gap-3">
            <dt className="text-[color:var(--muted)]">Format</dt>
            <dd className="text-[color:var(--navy-ink)] text-right">
              {format === "newsletter" ? "Newsletter" : "Quick note"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[color:var(--muted)]">Subject</dt>
            <dd className="text-[color:var(--navy-ink)] text-right font-semibold">
              {subject || "(empty)"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[color:var(--muted)]">Recipients</dt>
            <dd className="text-[color:var(--navy-ink)] text-right font-bold">
              {recipientCount.toLocaleString()}
            </dd>
          </div>
        </dl>
        <label className="block mb-4 text-sm">
          <span className="block mb-1 text-[color:var(--navy-ink)]">
            Type <code className="bg-ivory-2 px-1 font-mono">{expected}</code> to confirm:
          </span>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>
        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="text-sm text-[color:var(--muted)] hover:text-navy px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending || !matches}
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Sending…" : `Send to ${recipientCount}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
