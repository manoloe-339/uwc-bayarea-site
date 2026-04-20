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

function linkify(escaped: string): string {
  // Simple URL autolinker. Operates on already-escaped text.
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (m) => `<a href="${m}" style="color:#0265A8;">${m}</a>`
  );
}

/** Convert a plain-text body to lightweight HTML with a branded footer. */
export function renderEmailHtml(body: string, alumniId: number | null): string {
  const bodyHtml = linkify(escapeHtml(body)).replace(/\r\n|\r|\n/g, "<br>");
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
