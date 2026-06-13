import Link from "next/link";
import { getSiteSettings, DEFAULT_SIGNUP_THANKS } from "@/lib/settings";
import { renderSimpleMarkdown } from "@/lib/simple-markdown";
import { MarkdownTextarea } from "@/components/admin/MarkdownTextarea";
import { saveSignupThanksAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignupThanksSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const s = await getSiteSettings();

  const currentEyebrow = s.signup_thanks_eyebrow ?? "";
  const currentHeadline = s.signup_thanks_headline ?? "";
  const currentBodyMd = s.signup_thanks_body_md ?? "";
  const currentButton = s.signup_thanks_button_label ?? "";

  const previewEyebrow = currentEyebrow.trim() || DEFAULT_SIGNUP_THANKS.eyebrow;
  const previewHeadline = currentHeadline.trim() || DEFAULT_SIGNUP_THANKS.headline;
  const previewBodyMd = currentBodyMd.trim() || DEFAULT_SIGNUP_THANKS.bodyMd;
  const previewButton = currentButton.trim() || DEFAULT_SIGNUP_THANKS.buttonLabel;
  const previewHtml = renderSimpleMarkdown(previewBodyMd);

  return (
    <div className="max-w-[820px]">
      <div className="mb-2 text-sm text-[color:var(--muted)]">
        <Link href="/admin/tools" className="hover:text-navy underline">
          Admin tools
        </Link>{" "}
        &rarr; Signup confirmation page
      </div>
      <div className="mb-4">
        <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">
          Signup confirmation page
        </h1>
        <p className="text-[color:var(--muted)] text-sm max-w-[640px] mt-1">
          The page someone lands on after submitting{" "}
          <Link href="/signup" className="text-navy underline">
            /signup
          </Link>
          . Distinct from the confirmation <em>email</em>{" "}
          (edited{" "}
          <Link href="/admin/tools/signup-email" className="text-navy underline">
            here
          </Link>
          ). Body supports markdown — blank line for paragraph, **bold**,{" "}
          *italic*, and [links](https://example.com).
        </p>
      </div>

      {sp.saved && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          Saved.
        </div>
      )}

      <form
        action={saveSignupThanksAction}
        className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 space-y-5"
      >
        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Eyebrow
          </span>
          <input
            type="text"
            name="eyebrow"
            defaultValue={currentEyebrow}
            placeholder={DEFAULT_SIGNUP_THANKS.eyebrow}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
          <span className="block text-xs text-[color:var(--muted)] mt-1">
            Small uppercase label above the headline. Leave blank for the default:
            &ldquo;{DEFAULT_SIGNUP_THANKS.eyebrow}&rdquo;.
          </span>
        </label>

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Headline
          </span>
          <input
            type="text"
            name="headline"
            defaultValue={currentHeadline}
            placeholder={DEFAULT_SIGNUP_THANKS.headline}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
          <span className="block text-xs text-[color:var(--muted)] mt-1">
            Big serif headline. Leave blank for &ldquo;
            {DEFAULT_SIGNUP_THANKS.headline}&rdquo;.
          </span>
        </label>

        <MarkdownTextarea
          name="body_md"
          label="Body"
          defaultValue={currentBodyMd || DEFAULT_SIGNUP_THANKS.bodyMd}
          rows={10}
          hint="Markdown: blank line for paragraph, **bold**, *italic*, [link text](https://example.com). Leave entirely blank to use the default copy."
        />

        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Button label
          </span>
          <input
            type="text"
            name="button_label"
            defaultValue={currentButton}
            placeholder={DEFAULT_SIGNUP_THANKS.buttonLabel}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
          <span className="block text-xs text-[color:var(--muted)] mt-1">
            Button always links to the homepage. Leave blank for &ldquo;
            {DEFAULT_SIGNUP_THANKS.buttonLabel}&rdquo;.
          </span>
        </label>

        <div className="flex flex-wrap gap-3 pt-3 border-t border-[color:var(--rule)]">
          <button
            type="submit"
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide"
          >
            Save changes
          </button>
          <Link
            href="/signup/thanks"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-[color:var(--rule)] text-navy px-5 py-2.5 rounded text-sm font-semibold tracking-wide hover:border-navy"
          >
            Open /signup/thanks ↗
          </Link>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
          Preview (currently saved version)
        </h2>
        <div className="bg-[#F4EFE3] p-6 rounded-[10px] border border-[color:var(--rule)]">
          <div className="bg-white rounded-[10px] mx-auto p-7 sm:p-10 border border-[color:var(--rule)]" style={{ maxWidth: 560 }}>
            <div className="inline-flex items-center gap-3 text-[11px] tracking-[.32em] uppercase text-navy font-bold mb-3">
              <span className="inline-block w-8 h-0.5 bg-navy" aria-hidden />
              {previewEyebrow}
            </div>
            <h2
              className="font-sans font-bold text-[color:var(--navy-ink)] mt-2 mb-4"
              style={{ fontSize: "32px", lineHeight: "1.05", letterSpacing: "-.02em" }}
            >
              {previewHeadline}
            </h2>
            <div
              className="text-[14px] leading-[1.55] text-[color:var(--navy-ink)] [&_p]:mb-3 [&_p:last-child]:mb-5 [&_a]:text-navy [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
            <span className="inline-block bg-navy text-white px-4 py-2 rounded text-xs font-semibold">
              {previewButton}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
