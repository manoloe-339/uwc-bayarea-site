/**
 * Tiny markdown subset → HTML renderer. Only handles what the event
 * gallery description needs: paragraphs, bold, italic, links, single
 * line breaks. All other input is escaped as plain text. No
 * dependencies — keeps the bundle tiny and the surface area small.
 *
 * Supported syntax:
 *   - Paragraphs separated by one or more blank lines
 *   - # Heading / ## Heading / ### Heading    → <h1>/<h2>/<h3> (line-leading only)
 *   - **bold**           → <strong>bold</strong>
 *   - *italic*           → <em>italic</em>
 *   - [text](https://x)  → <a href="https://x">text</a>
 *   - ![alt](https://x)             → <img> (responsive, full-width block)
 *   - ![alt](https://x =150)        → <img width=150> (thumbnail; still auto-height)
 *   - ![alt](https://x =150x100)    → <img width=150 height=100>
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
  // Images — must run BEFORE links so `![alt](url)` isn't caught by the
  // link regex first. Only https URLs are embedded (safeHref filter);
  // anything else falls back to plain-text (the alt in brackets stays).
  //
  // Sizing: an optional `=WIDTH` or `=WIDTHxHEIGHT` suffix inside the
  // parens after the URL renders a smaller thumbnail. Without it, the
  // image renders full-width (block, max-width:100%) — right for hero
  // shots. With sizing, we switch to inline-block so multiple sized
  // images in a paragraph flow horizontally like a thumb strip.
  const imgRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+=(\d+)(?:x(\d+))?)?\)/g;
  s = s.replace(imgRe, (_m, alt, src, w, h) => {
    const safe = safeHref(src);
    if (!safe) return escapeHtml(String(alt));
    const altAttr = escapeAttr(String(alt));
    const width = w ? Number(w) : null;
    const height = h ? Number(h) : null;
    if (width) {
      const dims = height ? ` width="${width}" height="${height}"` : ` width="${width}"`;
      const style =
        `display:inline-block;max-width:100%;height:auto;` +
        `margin:4px 6px 4px 0;border-radius:6px;vertical-align:middle`;
      return `<img src="${escapeAttr(safe)}" alt="${altAttr}"${dims} style="${style}" />`;
    }
    return (
      `<img src="${escapeAttr(safe)}" alt="${altAttr}"` +
      ` style="display:block;max-width:100%;height:auto;margin:12px 0;border-radius:6px" />`
    );
  });
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
      // Heading detection — paragraph starts with 1–3 hashes + space.
      // Inline styles so headings survive in email clients that strip
      // stylesheets. Level-appropriate sizing; tight top margin so a
      // heading followed by body copy doesn't over-space.
      const headingMatch = p.trim().match(/^(#{1,3})\s+(.+?)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = applyInline(headingMatch[2], linkAttrs);
        return `<${HEADING_TAG[level]} style="${HEADING_STYLE[level]}">${text}</${HEADING_TAG[level]}>`;
      }
      // Apply inline transforms (links, bold, italic) to the WHOLE
      // paragraph first so a markdown link can span multiple lines —
      // the compose textarea wraps long URLs across newlines often.
      const inlined = applyInline(p, linkAttrs);
      // Then convert single newlines to <br>.
      const withBreaks = inlined
        .split("\n")
        .map((line) => line.trim())
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

// Heading styles used both in the compose preview (light) and in
// sent emails. Inline styles because mail clients strip stylesheets.
const HEADING_TAG: Record<number, string> = { 1: "h1", 2: "h2", 3: "h3" };
const HEADING_STYLE: Record<number, string> = {
  1: "font-family:'Fraunces','Georgia',serif;font-size:26px;font-weight:600;line-height:1.15;color:#0B2545;margin:18px 0 8px",
  2: "font-family:'Fraunces','Georgia',serif;font-size:20px;font-weight:600;line-height:1.2;color:#0B2545;margin:16px 0 6px",
  3: "font-family:'Fraunces','Georgia',serif;font-size:16px;font-weight:600;line-height:1.25;color:#0B2545;margin:12px 0 4px",
};

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
