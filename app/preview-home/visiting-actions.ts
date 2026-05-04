"use server";

import { getResend, fromAddress, replyToAddress } from "@/lib/resend";
import { createVisitingRequest, whatsappUrl } from "@/lib/visiting-requests";

const VISITING_TO = "manolo@uwcbayarea.org";

export interface VisitingResult {
  ok: boolean;
  error?: string;
}

/** Send a notification when a registered alum asks for the WhatsApp
 * invite link to their registered email. Manolo looks them up and
 * sends the link manually for now. */
export async function sendRegisteredAlumRequest(formData: FormData): Promise<VisitingResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, error: "Please enter your name." };
  }

  const text = [
    "Registered-alum WhatsApp invite request from the homepage modal.",
    "",
    `Name: ${name}`,
    "",
    "Action: look up this alum in the directory and send the WhatsApp join link to their registered email.",
  ].join("\n");

  const html = `
    <p>Registered-alum WhatsApp invite request from the homepage modal.</p>
    <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#666"><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
    </table>
    <p style="margin-top:12px;color:#666;font-size:13px">
      Look up this alum in the directory and send the WhatsApp join link
      to their registered email.
    </p>
  `;

  try {
    await getResend().emails.send({
      from: fromAddress(),
      to: VISITING_TO,
      replyTo: replyToAddress(),
      subject: "WhatsApp invite request — registered alum",
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send";
    return { ok: false, error: msg };
  }
}

/** Send a notification when someone fills out the "just visiting the
 * Bay Area" form on the WhatsApp join modal. Persists the row to
 * visiting_requests for the running list at /admin/tools/visiting,
 * then emails Manolo with all fields + a clickable wa.me phone link. */
export async function sendJustVisitingNotification(formData: FormData): Promise<VisitingResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const affiliation = String(formData.get("affiliation") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!firstName || !lastName || !affiliation || !email || !phone) {
    return {
      ok: false,
      error: "Name, UWC affiliation, email, and WhatsApp phone are required.",
    };
  }
  // Lightweight format check.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email doesn't look right." };
  }

  const fullName = `${firstName} ${lastName}`;
  const waUrl = whatsappUrl(phone);

  // Persist first so the request survives even if Resend hiccups.
  try {
    await createVisitingRequest({
      first_name: firstName,
      last_name: lastName,
      affiliation: affiliation || null,
      email,
      phone,
      note: note || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save";
    return { ok: false, error: msg };
  }

  const text = [
    "Just-visiting WhatsApp request from the homepage modal.",
    "",
    `Name:                   ${fullName}`,
    `UWC affiliation + year: ${affiliation}`,
    `Email:                  ${email}`,
    `WhatsApp phone:         ${phone}`,
    waUrl ? `WhatsApp link:          ${waUrl}` : "",
    note ? `\nNote: ${note}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const phoneCell = waUrl
    ? `<a href="${waUrl}" style="color:#0265A8">${escapeHtml(phone)}</a>`
    : escapeHtml(phone);

  const html = `
    <p>Just-visiting WhatsApp request from the homepage modal.</p>
    <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#666"><strong>Name</strong></td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666"><strong>UWC affiliation + year</strong></td><td>${escapeHtml(affiliation)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666"><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666"><strong>WhatsApp phone</strong></td><td>${phoneCell}</td></tr>
      ${note ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top"><strong>Note</strong></td><td>${escapeHtml(note)}</td></tr>` : ""}
    </table>
    <p style="margin-top:14px;color:#666;font-size:13px">
      View the running list at
      <a href="https://uwcbayarea.org/admin/tools/visiting" style="color:#0265A8">/admin/tools/visiting</a>.
    </p>
  `;

  try {
    await getResend().emails.send({
      from: fromAddress(),
      to: VISITING_TO,
      replyTo: replyToAddress() ?? email,
      subject: `just visiting SF · ${fullName}`,
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
