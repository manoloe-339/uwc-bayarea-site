import { signUnsubscribeToken } from "./unsubscribe-token";
import {
  renderSimpleMarkdown,
  EMAIL_LINK_ATTRS,
  EMAIL_PARAGRAPH_ATTRS,
} from "./simple-markdown";

export const GROUP_NAME = "UWC Bay Area";

function appUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/+$/, "");
  // Fallback to uwcbayarea.org in production if env missing.
  return "https://uwcbayarea.org";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const URL_TRAILING_PUNCT = /[.,;:!?)\]]+$/;

function linkify(escaped: string): string {
  // Autolink both http(s)://... and bare www.... URLs in already-escaped text.
  // For www-prefixed hits we synthesize https:// in the href so the link is
  // actually clickable (a bare `www.uwcbayarea.org` href would resolve
  // relative to the email's base URL and 404).
  return escaped.replace(
    /(\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+)/gi,
    (match) => {
      // Strip trailing punctuation that's almost always sentence-level,
      // not part of the URL.
      const url = match.replace(URL_TRAILING_PUNCT, "");
      const trailing = match.slice(url.length);
      const href = /^www\./i.test(url) ? `https://${url}` : url;
      return `<a href="${href}" style="color:#0265A8;">${url}</a>${trailing}`;
    }
  );
}

/** Convert a plain-text body to lightweight HTML with a branded footer. */
export function renderEmailHtml(body: string, alumniId: number | null): string {
  const bodyHtml = linkify(escapeHtml(body)).replace(/\r\n|\r|\n/g, "<br>");
  return wrapEmailHtml(bodyHtml, alumniId);
}

/** Same chrome as renderEmailHtml, but the caller supplies already-safe
 * HTML for the body (e.g. rendered from markdown). Skips escape/linkify. */
export function renderEmailHtmlFromHtml(bodyHtml: string, alumniId: number | null): string {
  return wrapEmailHtml(bodyHtml, alumniId);
}

/** Render a body that supports lightweight markdown ([text](url),
 * **bold**, *italic*, paragraphs) AND continues to auto-link bare
 * URLs. Used by Quick Note campaigns and any other plain-text-feeling
 * input that should still accept embedded links. */
export function renderEmailHtmlWithMarkdown(body: string, alumniId: number | null): string {
  const md = renderSimpleMarkdown(body, EMAIL_LINK_ATTRS, EMAIL_PARAGRAPH_ATTRS);
  const linkedBody = linkifyOutsideAnchors(md);
  return wrapEmailHtml(linkedBody, alumniId);
}

/** Auto-link bare URLs in already-rendered HTML, skipping text that
 * sits inside an existing <a>…</a> tag (so markdown links aren't
 * double-linked). */
function linkifyOutsideAnchors(html: string): string {
  const re = /<a\b[^>]*>[\s\S]*?<\/a>/g;
  let out = "";
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    out += linkify(html.slice(lastIdx, match.index));
    out += match[0];
    lastIdx = match.index + match[0].length;
  }
  out += linkify(html.slice(lastIdx));
  return out;
}

/** Plain-text companion: flatten markdown links so text-only readers
 * see both the label and the URL. "[Click here](https://x.com)" →
 * "Click here (https://x.com)". Bold/italic markers are stripped. */
export function flattenMarkdownForText(body: string): string {
  return body
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1");
}

function wrapEmailHtml(bodyHtml: string, alumniId: number | null): string {
  const unsubscribeLink = alumniId != null
    ? `${appUrl()}/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(alumniId))}`
    : `${appUrl()}/unsubscribe/manual`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0265A8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0B2545;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0265A8;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid rgba(11,37,69,0.16);border-radius:10px;">
            <tr>
              <td style="padding:24px 28px 0 28px;text-align:center;">
                <!-- Logo PNG has the design on a navy field (#0265A8).
                     Wrap in a rounded navy box so it sits cleanly on
                     the white card and matches the website header. -->
                <img
                  src="${appUrl()}/uwc-bay-area-logo.png"
                  alt="UWC Bay Area · Alumni & Friends"
                  width="140"
                  style="display:inline-block;width:140px;height:auto;border:0;outline:none;border-radius:6px;background:#0265A8;"
                />
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;font-size:16px;line-height:1.55;color:#0B2545;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px;border-top:1px solid rgba(11,37,69,0.12);font-size:12px;line-height:1.5;color:rgba(11,37,69,0.62);">
                You're receiving this because you're part of the ${escapeHtml(GROUP_NAME)} alumni network.<br>
                <a href="${unsubscribeLink}" style="color:#0265A8;text-decoration:underline;">Unsubscribe</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Plain-text version for clients that prefer it. */
export function renderEmailText(body: string, alumniId: number | null): string {
  const unsubscribeLink = alumniId != null
    ? `${appUrl()}/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(alumniId))}`
    : `${appUrl()}/unsubscribe/manual`;
  return `${body}

---
You're receiving this because you're part of the ${GROUP_NAME} alumni network.
Unsubscribe: ${unsubscribeLink}`;
}
