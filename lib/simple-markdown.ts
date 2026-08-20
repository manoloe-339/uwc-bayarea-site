import { emailOptimizedImageUrl } from "./image-transform";

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
 *   - [[bg=#f4efe3]]…[[/bg]]   → wrap the enclosed block in a
 *                                background-colored panel (also
 *                                accepts named colors + rgb()). Body
 *                                is still fully markdown-processed.
 *   - [text](https://x)  → <a href="https://x">text</a>
 *   - ![alt](https://x)             → <img> (responsive, full-width block)
 *   - ![alt](https://x =150)        → <img width=150> (thumbnail; still auto-height)
 *   - ![alt](https://x =150x100)    → <img width=150 height=100>
 *   - ![alt](https://x =48%)        → <img width=48%> (grid-friendly percentage width)
 *
 *   All Blob-hosted image srcs are auto-routed through the Next.js
 *   Image Optimization endpoint so email recipients download a small
 *   compressed JPEG (~50 KB) instead of the multi-megabyte original.
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
  // Sizing suffixes after the URL:
  //   =150      → 150px wide, auto height (thumb strip / inline flow)
  //   =150x100  → fixed both
  //   =48%      → percentage width (2x2 grids: 4 images at 48% wrap
  //               to two rows; 2 images at 48% share one row)
  // Absent → full-width block (single hero image).
  //
  // Blob URLs get routed through the Next.js Image Optimization proxy
  // so recipients download a compressed derivative (~50 KB) instead of
  // the multi-megabyte original upload.
  const imgRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+=(\d+%?)(?:x(\d+))?)?\)/g;
  s = s.replace(imgRe, (_m, alt, src, w, h) => {
    const safe = safeHref(src);
    if (!safe) return escapeHtml(String(alt));
    const altAttr = escapeAttr(String(alt));
    const rawW = typeof w === "string" ? w : null;
    const isPercent = rawW ? rawW.endsWith("%") : false;
    const width = rawW ? Number(rawW.replace("%", "")) : null;
    const height = h ? Number(h) : null;
    // Serve a smaller variant when the display width is small.
    // Percentages: assume "grid cell" → serve at thumb size (384w).
    // Fixed pixels: use the pixel width to pick a size.
    // No size: hero — serve at 640w.
    const optWidth = isPercent ? 300 : width;
    const optimizedSrc = emailOptimizedImageUrl(safe, optWidth);
    if (rawW) {
      const widthAttr = isPercent
        ? ` width="${width}%" style="width:${width}%;"`
        : ` width="${width}"`;
      const heightAttr = height && !isPercent ? ` height="${height}"` : "";
      // Percentage widths → inline-block so they wrap into grids.
      // Fixed pixels → inline-block for thumb strips.
      const boxStyle =
        `display:inline-block;height:auto;` +
        `margin:4px 4px 4px 0;border-radius:6px;vertical-align:top`;
      return (
        `<img src="${escapeAttr(optimizedSrc)}" alt="${altAttr}"` +
        `${widthAttr.replace(/style="[^"]*"/, "")}${heightAttr}` +
        ` style="${boxStyle}${isPercent ? `;width:${width}%` : ""}" />`
      );
    }
    return (
      `<img src="${escapeAttr(optimizedSrc)}" alt="${altAttr}"` +
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
  // Normalize the raw markdown so downstream detection is forgiving of
  // AI output that skips blank-line separators. Two rewrites:
  //   1. Inject a blank line before any `#{1,3} ` line so headings
  //      always start their own paragraph.
  //   2. Auto-close a lone opening `[[bg=…]]` at the end of the input
  //      if the AI forgot the closing tag (better to render the panel
  //      than to show literal '[[bg=#F6E9D7]]' in the email).
  // Belt: if the input has ZERO real newlines but has literal
  // backslash-n sequences, treat it as over-escaped and unescape.
  // Real markdown rarely contains bare \n text; AI over-escape
  // (seen when Claude echoes the JSON-stringified draft from the
  // system prompt) does.
  let raw = String(md);
  if (!raw.includes("\n") && /\\n/.test(raw)) {
    raw = raw.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }
  let normalized = raw.replace(/([^\n])\n(#{1,3}\s)/g, "$1\n\n$2");
  const openBgCount = (normalized.match(/\[\[bg=/g) ?? []).length;
  const closeBgCount = (normalized.match(/\[\[\/bg\]\]/g) ?? []).length;
  if (openBgCount > closeBgCount) {
    normalized = normalized + "\n[[/bg]]".repeat(openBgCount - closeBgCount);
  }
  // Extract "[[bg=color]]…[[/bg]]" fenced blocks BEFORE HTML-escaping
  // so we can capture the color literally. Body inside the fence is
  // still fully markdown-processed via a nested render. Only tolerant
  // of a small set of characters in the color to keep this safe:
  // hex (#f4efe3), rgb() with digits/spaces/commas/dots/percent,
  // named CSS colors (letters). Anything else falls through to
  // plain text.
  const bgRe = /\[\[bg=([#a-zA-Z0-9(),.\s%]+)\]\]([\s\S]*?)\[\[\/bg\]\]/g;
  const bgBlocks: Array<{ color: string; body: string }> = [];
  const withPlaceholders = normalized.replace(bgRe, (_m, color, body) => {
    const safeColor = String(color).trim();
    if (!/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)$/.test(safeColor)) {
      return _m; // leave as literal so admin sees the syntax and fixes it
    }
    bgBlocks.push({ color: safeColor, body: String(body).trim() });
    // Placeholder is a unique paragraph that survives escape+split.
    return `\n\n BG_BLOCK_${bgBlocks.length - 1} \n\n`;
  });
  const escaped = escapeHtml(withPlaceholders);
  // Split into paragraphs on blank lines.
  const paragraphs = escaped.split(/\n{2,}/);
  const blocks = paragraphs
    .map((p) => {
      // BG placeholder → recurse into nested markdown for the body,
      // then wrap in a bg-colored panel.
      const bgMatch = p.trim().match(/^BG_BLOCK_(\d+)$/);
      if (bgMatch) {
        const block = bgBlocks[Number(bgMatch[1])];
        if (!block) return "";
        const inner = renderSimpleMarkdown(block.body, linkAttrs, paragraphAttrs);
        return (
          `<div style="background:${block.color};padding:14px 16px;margin:12px 0;border-radius:8px">` +
          `${inner}` +
          `</div>`
        );
      }
      // Image-grid detection — a paragraph that consists ONLY of
      // percentage-width images (with optional whitespace between) gets
      // rendered as a <table>. Gmail + Outlook ignore inline-block on
      // <img>, so we get vertical stacks; tables are the reliable
      // horizontal layout primitive in email HTML.
      const gridRow = tryRenderImageGrid(p);
      if (gridRow) return gridRow;

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

/** Detect a paragraph that's ONLY percentage-width markdown images
 *  and render as a <table>-based grid — the reliable email-safe way
 *  to lay images out side-by-side. Returns null if the paragraph
 *  isn't a pure image grid, so the caller falls through to normal
 *  paragraph rendering.
 *
 *  Layout: cells fill `100 / <first-cell-width>%` per row and wrap.
 *  Four images at 48% → 2 per row → 2 rows. Two at 48% → 1 row.
 *  Three at 32% → 3 per row → 1 row.
 *
 *  Cells are always SQUARE (1:1) with object-fit:cover, so mixed
 *  portrait/landscape/square source photos land in a uniform grid.
 *  Optional `focal=X,Y` suffix on each image (`![alt](url =48% focal=30,60)`)
 *  moves the crop centering — 50/50 by default.
 */
function tryRenderImageGrid(paragraph: string): string | null {
  const trimmed = paragraph.trim();
  if (!trimmed.startsWith("![")) return null;
  // Match a percentage-width image with optional crop=X,Y,W,H suffix
  // (all percentages of the source dimensions). Legacy focal=X,Y is
  // accepted and converted to a full-source crop centered on X,Y.
  const cellRe =
    /!\[([^\]]*)\]\(([^)\s]+)\s+=(\d+)%(?:\s+(?:crop=([\d.]+),([\d.]+),([\d.]+),([\d.]+)|focal=(\d+),(\d+)))?\)/g;
  const cells: Array<{
    alt: string;
    url: string;
    width: number;
    cropX: number | null;
    cropY: number | null;
    cropW: number | null;
    cropH: number | null;
  }> = [];
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(trimmed)) !== null) {
    const gap = trimmed.slice(lastEnd, m.index);
    if (gap.trim().length > 0) return null;
    let cropX: number | null = null;
    let cropY: number | null = null;
    let cropW: number | null = null;
    let cropH: number | null = null;
    if (m[4] != null) {
      // crop=X,Y,W,H (all percentages 0-100)
      const cx = Number(m[4]);
      const cy = Number(m[5]);
      const cw = Number(m[6]);
      const ch = Number(m[7]);
      // Guard against buggy legacy values in pixel units (e.g. 3024).
      // Any component >100 means these can't be percentages — ignore
      // and let the cell fall back to default center-cover.
      if (cx <= 100 && cy <= 100 && cw > 0 && cw <= 100 && ch > 0 && ch <= 100) {
        cropX = cx;
        cropY = cy;
        cropW = cw;
        cropH = ch;
      }
    } else if (m[8] != null) {
      // legacy focal=X,Y — approximate as a 60%-square crop centered on it
      const fx = Number(m[8]);
      const fy = Number(m[9]);
      cropW = 60;
      cropH = 60;
      cropX = Math.max(0, Math.min(40, fx - 30));
      cropY = Math.max(0, Math.min(40, fy - 30));
    }
    cells.push({
      alt: m[1],
      url: m[2],
      width: Number(m[3]),
      cropX,
      cropY,
      cropW,
      cropH,
    });
    lastEnd = cellRe.lastIndex;
  }
  const trailing = trimmed.slice(lastEnd);
  if (trailing.trim().length > 0) return null;
  if (cells.length < 2) return null;
  const firstWidth = cells[0].width;
  const cellsPerRow = Math.max(1, Math.floor(100 / firstWidth));
  const rows: Array<typeof cells> = [];
  for (let i = 0; i < cells.length; i += cellsPerRow) {
    rows.push(cells.slice(i, i + cellsPerRow));
  }
  // Responsive percentage-width cells so Gmail Mobile doesn't
  // shrink-to-fit the whole email (which was making body text look
  // tiny on phones). Square aspect via padding-top:100% trick on a
  // responsive inner div — the % is relative to the div's width,
  // producing width==height. Image is absolutely positioned inside
  // with explicit top/left/width/height (avoid inset shorthand which
  // Gmail doesn't parse).
  const rowsHtml = rows
    .map((row) => {
      const cellHtml = row
        .map((cell) => {
          const optimizedSrc = emailOptimizedImageUrl(cell.url, 300);
          const altAttr = escapeAttr(cell.alt);
          let imgStyle: string;
          if (cell.cropX != null && cell.cropW && cell.cropH) {
            // Scaled + offset in PERCENTAGES of the square container,
            // so the whole thing stays responsive. Math: image is
            // sized to (100/cropW * 100)% wide so the crop rect fills
            // the container; shifted left by -(cropX/cropW)*100%.
            const imgWpct = 100 / cell.cropW * 100;
            const imgHpct = 100 / cell.cropH * 100;
            const leftPct = -cell.cropX * 100 / cell.cropW;
            const topPct = -(cell.cropY ?? 0) * 100 / cell.cropH;
            imgStyle =
              `position:absolute;top:${topPct.toFixed(2)}%;left:${leftPct.toFixed(2)}%;` +
              `width:${imgWpct.toFixed(2)}%;height:${imgHpct.toFixed(2)}%;` +
              `max-width:none;display:block;border:0`;
          } else {
            imgStyle =
              `position:absolute;top:0;left:0;width:100%;height:100%;` +
              `object-fit:cover;object-position:50% 50%;display:block;border:0`;
          }
          return (
            `<td style="width:${cell.width}%;padding:3px;vertical-align:top">` +
            `<div style="position:relative;width:100%;padding-top:100%;overflow:hidden;` +
            `border-radius:6px;background:#e5e7eb">` +
            `<img src="${escapeAttr(optimizedSrc)}" alt="${altAttr}" style="${imgStyle}" />` +
            `</div>` +
            `</td>`
          );
        })
        .join("");
      const padCount = cellsPerRow - row.length;
      const padding = padCount > 0
        ? `<td style="width:${row[0].width * padCount}%">&nbsp;</td>`
        : "";
      return `<tr>${cellHtml}${padding}</tr>`;
    })
    .join("");
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" ` +
    `style="width:100%;border-collapse:collapse;margin:10px 0"><tbody>` +
    `${rowsHtml}</tbody></table>`
  );
}

// Heading styles used both in the compose preview (light) and in
// sent emails. Inline styles because mail clients strip stylesheets.
const HEADING_TAG: Record<number, string> = { 1: "h1", 2: "h2", 3: "h3" };
// Match the newsletter template's H1/H2 font stack (system sans-serif)
// so AI-generated ## headings in the body look like the template's
// built-in headings — not a serif fallback in the middle of a sans
// email. Web fonts (Fraunces / Instrument Serif) don't reliably load
// in Gmail/Outlook anyway; system fonts are the honest choice for
// email + preview consistency.
const HEADING_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const HEADING_STYLE: Record<number, string> = {
  1: `font-family:${HEADING_FONT_STACK};font-size:26px;font-weight:700;line-height:1.15;color:#0B2545;margin:18px 0 8px;letter-spacing:-0.01em`,
  2: `font-family:${HEADING_FONT_STACK};font-size:20px;font-weight:700;line-height:1.2;color:#0B2545;margin:16px 0 6px`,
  3: `font-family:${HEADING_FONT_STACK};font-size:16px;font-weight:700;line-height:1.25;color:#0B2545;margin:12px 0 4px`,
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
