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

function applyInline(escaped: string): string {
  let s = escaped;
  // Links — match before bold/italic so the URL part isn't munged.
  // Pattern allows escaped brackets to NOT be inside the text part.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, href) => {
    const safe = safeHref(href);
    if (!safe) return text;
    return `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener noreferrer" class="underline hover:text-navy">${text}</a>`;
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

/** Convert a tiny-markdown string to safe HTML for use in
 * dangerouslySetInnerHTML. Returns "" for empty/null input. */
export function renderSimpleMarkdown(md: string | null | undefined): string {
  if (!md || !md.trim()) return "";
  const escaped = escapeHtml(md);
  // Split into paragraphs on blank lines.
  const paragraphs = escaped.split(/\n{2,}/);
  return paragraphs
    .map((p) => {
      // Within a paragraph, single newlines become <br>.
      const withBreaks = p
        .split("\n")
        .map((line) => applyInline(line.trim()))
        .filter((line) => line.length > 0)
        .join("<br>");
      if (!withBreaks) return "";
      return `<p>${withBreaks}</p>`;
    })
    .filter((p) => p.length > 0)
    .join("\n");
}
