"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getResend, fromAddress, replyToAddress } from "@/lib/resend";
import {
  createVolunteerSignup,
  VOLUNTEER_AREAS,
  type VolunteerArea,
} from "@/lib/volunteer-signups";
import { matchAlumniForAttendee } from "@/lib/alumni-matcher";

const VALID_AREAS = new Set<VolunteerArea>([
  "national",
  "outreach",
  "events",
  "donors",
  "other",
]);

const NOTIFICATION_TO = "manolo@uwcbayarea.org";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function submitHelpOutAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const areasRaw = String(formData.get("areas") ?? "").trim();
  const committee = String(formData.get("national_committee") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!name && !email) {
    throw new Error("Add your name or email to continue.");
  }
  if (email && !/.+@.+\..+/.test(email)) {
    throw new Error("That email doesn't look right.");
  }

  const areas = areasRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is VolunteerArea => VALID_AREAS.has(s as VolunteerArea));
  if (areas.length === 0) {
    throw new Error("Pick at least one area to continue.");
  }

  // Run the same matcher used for ticket purchases. Only auto-attach the
  // alumni id when the match is high-confidence; ambiguous matches are
  // recorded as 'needs_review' (no link yet) so admin reviews and links
  // manually from /admin/help-out.
  const match = await matchAlumniForAttendee({
    name: name || null,
    email: email || null,
    uwcCollege: null,
  });
  const autoLinkAlumniId =
    match.matchConfidence === "high" ? match.alumniId : null;

  await createVolunteerSignup({
    alumniId: autoLinkAlumniId,
    submittedName: name,
    submittedEmail: email,
    areas,
    nationalCommitteeChoice: areas.includes("national") ? (committee || null) : null,
    note: note || null,
    matchStatus: match.matchStatus,
    matchConfidence: match.matchConfidence,
    matchReason: match.matchReason,
  });

  // Notify the admin. Best-effort — never block submit on email failure.
  try {
    const resend = getResend();
    const matchedLine =
      match.matchStatus === "matched"
        ? `Yes (${match.matchConfidence ?? "auto"}: ${match.matchReason})`
        : match.matchStatus === "needs_review"
          ? `Needs review — ${match.matchReason}`
          : `No (not in directory)`;
    const areaLabels = areas.map(
      (a) => VOLUNTEER_AREAS.find((x) => x.value === a)?.label ?? a
    );
    const subject = `New volunteer signup: ${name || email}`;
    const lines = [
      `New volunteer interest from the Help Out page.`,
      ``,
      `Name: ${name || "(blank)"}`,
      `Email: ${email || "(blank)"}`,
      `In directory: ${matchedLine}`,
      `Areas: ${areaLabels.join(", ")}`,
    ];
    if (areas.includes("national")) {
      lines.push(`National committee preference: ${committee || "(none)"}`);
    }
    if (note) {
      lines.push(``, `Note:`, note);
    }
    const text = lines.join("\n");
    const html = `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0A2540;">
  <h2 style="margin-bottom:8px;">New volunteer signup</h2>
  <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px; line-height: 1.5;">
    <tr><td style="padding: 4px 12px 4px 0; color: #6B7280;">Name</td><td>${escapeHtml(name || "(blank)")}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #6B7280;">Email</td><td><a href="mailto:${escapeHtml(email)}" style="color:#0265A8;">${escapeHtml(email || "(blank)")}</a></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #6B7280;">In directory?</td><td>${escapeHtml(matchedLine)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #6B7280; vertical-align: top;">Areas</td><td>${areaLabels.map(escapeHtml).join("<br/>")}</td></tr>
    ${areas.includes("national") ? `<tr><td style="padding: 4px 12px 4px 0; color: #6B7280;">National committee</td><td>${escapeHtml(committee || "(none)")}</td></tr>` : ""}
    ${note ? `<tr><td style="padding: 12px 12px 4px 0; color: #6B7280; vertical-align: top;">Note</td><td style="padding-top: 12px; white-space: pre-wrap;">${escapeHtml(note)}</td></tr>` : ""}
  </table>
  <p style="margin-top:24px; font-size: 12px; color: #6B7280;">Triage at <a href="https://uwcbayarea.org/admin/help-out" style="color:#0265A8;">/admin/help-out</a></p>
</body></html>`;

    await resend.emails.send({
      from: fromAddress(),
      to: NOTIFICATION_TO,
      replyTo: email && /.+@.+\..+/.test(email) ? email : replyToAddress(),
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[help-out] notification email failed (signup still saved):", err);
  }

  revalidatePath("/admin/help-out");
  redirect("/help-out/thanks");
}
