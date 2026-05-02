"use server";

import { getResend, fromAddress, replyToAddress } from "@/lib/resend";

const VISITING_TO = "manolo@uwcbayarea.org";

export interface VisitingResult {
  ok: boolean;
  error?: string;
}

/** Send a notification when someone fills out the "just visiting the
 * Bay Area" form on the WhatsApp join modal. */
export async function sendJustVisitingNotification(formData: FormData): Promise<VisitingResult> {
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!email || !phone) {
    return { ok: false, error: "Email and WhatsApp phone number are required." };
  }
  // Lightweight format check.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email doesn't look right." };
  }

  const text = [
    "Just-visiting WhatsApp request from the homepage modal.",
    "",
    `UWC affiliation email: ${email}`,
    `WhatsApp phone:        ${phone}`,
    note ? `\nNote: ${note}` : "",
  ].join("\n");

  const html = `
    <p>Just-visiting WhatsApp request from the homepage modal.</p>
    <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#666"><strong>UWC affiliation email</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666"><strong>WhatsApp phone</strong></td><td>${escapeHtml(phone)}</td></tr>
      ${note ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top"><strong>Note</strong></td><td>${escapeHtml(note)}</td></tr>` : ""}
    </table>
  `;

  try {
    await getResend().emails.send({
      from: fromAddress(),
      to: VISITING_TO,
      replyTo: replyToAddress() ?? email,
      subject: "just visiting SF",
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send";
    return { ok: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
