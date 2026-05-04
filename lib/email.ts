import { signUnsubscribeToken } from "./unsubscribe-token";

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

function wrapEmailHtml(bodyHtml: string, alumniId: number | null): string {
  const unsubscribeLink = alumniId != null
    ? `${appUrl()}/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(alumniId))}`
    : `${appUrl()}/unsubscribe/manual`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4EFE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0B2545;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EFE3;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid rgba(11,37,69,0.16);border-radius:10px;">
            <tr>
              <td style="padding:28px 32px;font-size:16px;line-height:1.55;color:#0B2545;">
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
