"use server";

import { sql } from "@/lib/db";
import { getResend, fromAddress, replyToAddress } from "@/lib/resend";
import { createVisitingRequest, whatsappUrl } from "@/lib/visiting-requests";
import { createRegisteredWhatsappRequest } from "@/lib/whatsapp-requests";

const VISITING_TO = "manolo@uwcbayarea.org";
const ADMIN_BASE = "https://uwcbayarea.org/admin/alumni";

type AlumniCandidate = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

/** Find alumni rows that plausibly match a free-form name. Tries
 * first+last, then last-only, then first-only. Caps at 5 rows so the
 * email stays readable when a name is generic. */
async function findAlumniCandidates(name: string): Promise<AlumniCandidate[]> {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";

  if (first && last) {
    const rows = (await sql`
      SELECT id, first_name, last_name, email FROM alumni
      WHERE deceased IS NOT TRUE
        AND lower(first_name) LIKE ${`%${first}%`}
        AND lower(last_name) LIKE ${`%${last}%`}
      ORDER BY last_name, first_name
      LIMIT 5
    `) as AlumniCandidate[];
    if (rows.length > 0) return rows;
  }

  if (last) {
    const rows = (await sql`
      SELECT id, first_name, last_name, email FROM alumni
      WHERE deceased IS NOT TRUE
        AND lower(last_name) LIKE ${`%${last}%`}
      ORDER BY last_name, first_name
      LIMIT 5
    `) as AlumniCandidate[];
    if (rows.length > 0) return rows;
  }

  const rows = (await sql`
    SELECT id, first_name, last_name, email FROM alumni
    WHERE deceased IS NOT TRUE
      AND lower(first_name) LIKE ${`%${first}%`}
    ORDER BY last_name, first_name
    LIMIT 5
  `) as AlumniCandidate[];
  return rows;
}

function candidateLabel(c: AlumniCandidate): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "(no name)";
  return c.email ? `${name} <${c.email}>` : name;
}

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

  let candidates: AlumniCandidate[] = [];
  try {
    candidates = await findAlumniCandidates(name);
  } catch {
    // Lookup is best-effort; fall through and send the request anyway.
  }

  // Persist the request so it shows up in the admin tool. Auto-link
  // when there's exactly one match; otherwise leave alumni_id null and
  // let the admin disambiguate.
  try {
    await createRegisteredWhatsappRequest({
      alumni_id: candidates.length === 1 ? candidates[0].id : null,
      raw_name: name,
    });
  } catch (err) {
    console.warn("[whatsapp-request] persist failed:", err);
  }

  const matchHeader =
    candidates.length === 0
      ? "Possible match: none found in alumni directory."
      : candidates.length === 1
        ? "Possible match:"
        : `Possible matches (${candidates.length}):`;

  const text = [
    "Registered-alum WhatsApp invite request from the homepage modal.",
    "",
    `Name: ${name}`,
    "",
    matchHeader,
    ...candidates.map((c) => `  ${candidateLabel(c)} — ${ADMIN_BASE}/${c.id}`),
    "",
    "Review and send the invite from the admin tool:",
    "https://uwcbayarea.org/admin/tools/whatsapp?tab=requests",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const matchHtml =
    candidates.length === 0
      ? `<p style="margin-top:14px;color:#666;font-size:13px">No match found in the alumni directory.</p>`
      : `
          <p style="margin-top:14px;margin-bottom:4px;color:#666;font-size:13px"><strong>${
            candidates.length === 1 ? "Possible match" : `Possible matches (${candidates.length})`
          }:</strong></p>
          <ul style="margin:0;padding-left:18px;font-family:system-ui,sans-serif;font-size:14px">
            ${candidates
              .map(
                (c) =>
                  `<li><a href="${ADMIN_BASE}/${c.id}" style="color:#0265A8">${escapeHtml(
                    candidateLabel(c),
                  )}</a></li>`,
              )
              .join("")}
          </ul>
        `;

  const html = `
    <p>Registered-alum WhatsApp invite request from the homepage modal.</p>
    <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#666"><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
    </table>
    ${matchHtml}
    <p style="margin-top:14px;color:#666;font-size:13px">
      Review and send the invite from the admin tool:
      <a href="https://uwcbayarea.org/admin/tools/whatsapp?tab=requests" style="color:#0265A8">/admin/tools/whatsapp</a>.
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
      <a href="https://uwcbayarea.org/admin/tools/whatsapp?tab=visiting" style="color:#0265A8">/admin/tools/whatsapp</a>.
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
