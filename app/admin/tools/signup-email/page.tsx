import Link from "next/link";
import { getSiteSettings, DEFAULT_SIGNUP_CONFIRMATION } from "@/lib/settings";
import {
  applyConfirmationPlaceholders,
  fetchCollegeAlumniCount,
} from "@/lib/signup-confirmation";
import { renderSimpleMarkdown, EMAIL_LINK_ATTRS } from "@/lib/simple-markdown";
import { MarkdownTextarea } from "@/components/admin/MarkdownTextarea";
import { saveSignupEmailAction, sendTestSignupEmailAction } from "./actions";

export const dynamic = "force-dynamic";

const PREVIEW_COLLEGE = "UWC Atlantic College";

export default async function SignupEmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; test?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const s = await getSiteSettings();

  const currentSubject = s.signup_confirmation_subject ?? "";
  const currentBodyMd = s.signup_confirmation_body_md ?? "";

  // Render the live preview using whatever's currently saved (or the
  // default if blank). Pre-rendered server-side so the admin sees
  // exactly what new signups will receive — including a real college
  // count so {college_blurb} substitutes the way it will in production.
  const previewMd = currentBodyMd.trim() || DEFAULT_SIGNUP_CONFIRMATION.bodyMd;
  const previewCount = await fetchCollegeAlumniCount(PREVIEW_COLLEGE).catch(() => 0);
  const previewResolvedMd = applyConfirmationPlaceholders(previewMd, {
    college: PREVIEW_COLLEGE,
    collegeCount: previewCount,
  });
  const previewHtml = renderSimpleMarkdown(previewResolvedMd, EMAIL_LINK_ATTRS);

  return (
    <div className="max-w-[820px]">
      <div className="mb-2 text-sm text-[color:var(--muted)]">
        <Link href="/admin/tools" className="hover:text-navy underline">
          Admin tools
        </Link>{" "}
        &rarr; Signup confirmation email
      </div>
      <div className="mb-4">
        <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">
          Signup confirmation email
        </h1>
        <p className="text-[color:var(--muted)] text-sm max-w-[640px] mt-1">
          The email that goes out when someone signs up at{" "}
          <Link href="/signup" className="text-navy underline">
            /signup
          </Link>
          . Salutation (&ldquo;Hi {"{firstName}"},&rdquo;) is added
          automatically &mdash; just write the message body. Use the toolbar
          to add markdown links, bold, italics.
        </p>
      </div>

      {sp.saved && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          Saved.
        </div>
      )}
      {sp.test === "sent" && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-emerald-700 rounded-[2px] text-sm">
          Test email sent to manoloe@gmail.com. Check your inbox.
        </div>
      )}
      {sp.test === "failed" && (
        <div className="mb-5 p-3 bg-rose-50 border-l-4 border-rose-700 rounded-[2px] text-sm text-rose-900">
          Test send failed: {sp.msg ?? "unknown error"}
        </div>
      )}

      <form
        action={saveSignupEmailAction}
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
            placeholder={DEFAULT_SIGNUP_CONFIRMATION.subject}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
          <span className="block text-xs text-[color:var(--muted)] mt-1">
            Leave blank to use the default: &ldquo;
            {DEFAULT_SIGNUP_CONFIRMATION.subject}&rdquo;.
          </span>
        </label>

        <MarkdownTextarea
          name="body_md"
          label="Message body"
          defaultValue={currentBodyMd || DEFAULT_SIGNUP_CONFIRMATION.bodyMd}
          rows={14}
          hint="Salutation and unsubscribe footer are added automatically. Markdown: blank line for paragraph, **bold**, *italic*, [click here](https://uwcbayarea.org/photos). Placeholders: {college_blurb} (auto-generated sentence), {college}, {college_count} — all hide gracefully when the signup didn't pick a college."
        />

        <div className="flex flex-wrap gap-3 pt-3 border-t border-[color:var(--rule)]">
          <button
            type="submit"
            formAction={saveSignupEmailAction}
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide"
          >
            Save changes
          </button>
          <button
            type="submit"
            formAction={sendTestSignupEmailAction}
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
            className="bg-white rounded-[10px] mx-auto p-7 text-[15px] leading-[1.55] text-[color:var(--navy-ink)] [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-[#0265A8] [&_a]:underline"
            style={{ maxWidth: 560, border: "1px solid rgba(11,37,69,0.16)" }}
          >
            <p className="mb-3">Hi {"{firstName}"},</p>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            <div className="mt-6 pt-4 border-t border-[color:var(--rule)] text-xs text-[color:var(--muted)]">
              You&rsquo;re receiving this because you&rsquo;re part of the UWC
              Bay Area alumni network.
              <br />
              <span className="text-[#0265A8] underline">Unsubscribe</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-[color:var(--muted)] mt-2">
          The preview above shows what new signups will see. To send yourself
          a real test through Resend &rarr; your inbox, use the &ldquo;Send
          test&rdquo; button.
        </p>
      </section>
    </div>
  );
}
