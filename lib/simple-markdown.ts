/**
 * Tiny markdown subset → HTML renderer. Only handles what the event
 * gallery description needs: paragraphs, bold, italic, links, single
 * line breaks. All other input is escaped as plain text. No
 * dependencies — keeps the bundle tiny and the surface area small.
 *
 * Supported syntax:
 *   - Paragraphs separated by one or more blank lines
 *   - **bold**           → <strong>bold</strong>
 *   - *italic*           → <em>italic</em>
 *   - [text](https://x)  → <a href="https://x">text</a>
 *   - Single \n          → <br>
 *
 * Anything HTML-y in the input is escaped first, so admin can't
 * accidentally inject markup.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Whitelist URL schemes to prevent javascript: / data: payloads. */
function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  // Allow relative URLs starting with / and #.
  if (url.startsWith("/") || url.startsWith("#")) return url;
  if (/^(https?|mailto|tel):/i.test(url)) return url;
  return null;
}

function applyInline(escaped: string, linkAttrs: string): string {
  let s = escaped;
  // Links — match before bold/italic so the URL part isn't munged.
  // Pattern allows escaped brackets to NOT be inside the text part.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, href) => {
    const safe = safeHref(href);
    if (!safe) return text;
    return `<a href="${escapeAttr(safe)}" ${linkAttrs}>${text}</a>`;
  });
  // Bold (greedy double-asterisk).
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // Italic (single asterisk; require non-asterisk inside to avoid eating bold).
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return s;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

const DEFAULT_LINK_ATTRS = `target="_blank" rel="noopener noreferrer" class="underline hover:text-navy"`;

/** Convert a tiny-markdown string to safe HTML for use in
 * dangerouslySetInnerHTML. Returns "" for empty/null input.
 *
 * `linkAttrs` is rendered verbatim onto each `<a>` tag. The default
 * is Tailwind for in-page rendering; pass an inline-style version
 * for email rendering (where Tailwind classes don't load).
 *
 * `paragraphAttrs` is rendered verbatim onto each `<p>` tag. Defaults
 * to nothing (so callers using their own CSS — like in-page Tailwind —
 * keep working). Pass an inline-styled value for email and the
 * renderer will also insert explicit spacer paragraphs between blocks
 * (some mail clients silently drop `<p>` margins, hence the spacers). */
export function renderSimpleMarkdown(
  md: string | null | undefined,
  linkAttrs: string = DEFAULT_LINK_ATTRS,
  paragraphAttrs: string = "",
): string {
  if (!md || !md.trim()) return "";
  const openTag = paragraphAttrs ? `<p ${paragraphAttrs}>` : "<p>";
  const escaped = escapeHtml(md);
  // Split into paragraphs on blank lines.
  const paragraphs = escaped.split(/\n{2,}/);
  const blocks = paragraphs
    .map((p) => {
      // Within a paragraph, single newlines become <br>.
      const withBreaks = p
        .split("\n")
        .map((line) => applyInline(line.trim(), linkAttrs))
        .filter((line) => line.length > 0)
        .join("<br>");
      if (!withBreaks) return "";
      return `${openTag}${withBreaks}</p>`;
    })
    .filter((p) => p.length > 0);
  // Email mode: weave a spacer paragraph between content blocks. A
  // tiny-font/short-line empty paragraph reliably renders ~16px tall
  // in every mail client we care about, even when <p> margins are
  // dropped.
  const separator = paragraphAttrs ? `\n${EMAIL_SPACER}\n` : "\n";
  return blocks.join(separator);
}

/** Inline-styled link attrs matching the rest of the email chrome. */
export const EMAIL_LINK_ATTRS =
  `style="color:#0265A8;text-decoration:underline" target="_blank" rel="noopener noreferrer"`;

/** Inline-styled paragraph attrs for email rendering. Margins are
 * intentionally zeroed — paragraph spacing is provided by the spacer
 * paragraphs the renderer weaves between blocks (more reliable than
 * relying on `<p>` margin support across mail clients). */
export const EMAIL_PARAGRAPH_ATTRS = `style="margin:0"`;

/** Visual spacer used between email content blocks. A bare div with
 * fixed height is the most reliable cross-client way to guarantee
 * vertical space — every mail client (and browser preview) renders a
 * `<div>` as a block with the height we set, regardless of how it
 * handles `<p>` margins. Exported so call sites that build extra
 * blocks (e.g. the salutation in email-send.ts) can match the spacing. */
export const EMAIL_SPACER = `<div style="height:16px;line-height:16px;font-size:0">&nbsp;</div>`;
