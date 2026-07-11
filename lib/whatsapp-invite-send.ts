/**
 * Shared "send the WhatsApp invite email" helper. Used by:
 *
 *  - The admin tool at /admin/tools/whatsapp — manual approval path
 *    when a registered alum requests an invite via the homepage modal.
 *  - The trusted-token /join-whatsapp?invite=… path — fired
 *    automatically when a freshly-signed-up alum clicks the link in
 *    their confirmation email (we already know who they are, so no
 *    admin step is needed).
 *
 * Both paths must render the same email body, log the same audit row,
 * and notify the admin the same way — keeping the logic here ensures
 * they don't drift apart.
 */
import { sql } from "@/lib/db";
import { sendTestEmail } from "@/lib/email-send";
import {
  renderSimpleMarkdown,
  EMAIL_LINK_ATTRS,
  EMAIL_PARAGRAPH_ATTRS,
} from "@/lib/simple-markdown";
import { getSiteSettings, DEFAULT_WHATSAPP_INVITE } from "@/lib/settings";
import { ensureParagraphBreaks } from "@/lib/signup-confirmation";

const ADMIN_EMAIL = "manoloe@gmail.com";

export type AlumInvitePayload = {
  alumni_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  raw_name: string;
};

function applyWhatsappPlaceholders(
  md: string,
  ctx: { whatsappUrl: string },
): string {
  return md.replaceAll("{whatsapp_url}", ctx.whatsappUrl);
}

/** How recently we'll silently dedupe a duplicate send to the same
 * alum. 1 hour catches the common double-click / refresh-and-retry
 * pattern without blocking a legitimate later re-send. */
const WHATSAPP_DEDUP_WINDOW_MINUTES = 60;

export async function sendWhatsappInviteToAlum(
  alum: AlumInvitePayload,
  opts: { force?: boolean } = {},
): Promise<
  | { ok: true; deduped?: boolean }
  | { ok: false; error: string }
> {
  // Guard against double-fires: if a WhatsApp invite already went to
  // this alum within the dedup window, return ok without sending
  // again. Pass { force: true } to bypass (admin re-send path).
  if (!opts.force) {
    try {
      const recent = (await sql`
        SELECT id FROM email_sends
        WHERE alumni_id = ${alum.alumni_id}
          AND kind = 'whatsapp_invite'
          AND status = 'sent'
          AND sent_at > NOW() - (${WHATSAPP_DEDUP_WINDOW_MINUTES} || ' minutes')::interval
        LIMIT 1
      `) as Array<{ id: string }>;
      if (recent.length > 0) {
        console.log(
          `[whatsapp-invite] dedup hit for alumni=${alum.alumni_id} — already sent in last ${WHATSAPP_DEDUP_WINDOW_MINUTES}min, skipping`,
        );
        return { ok: true, deduped: true };
      }
    } catch (err) {
      // Dedup query failure shouldn't block a legitimate send — log
      // and continue.
      console.warn(
        `[whatsapp-invite] dedup check failed for alumni=${alum.alumni_id}:`,
        err,
      );
    }
  }

  const settings = await getSiteSettings();
  const subject =
    (settings.whatsapp_invite_subject ?? "").trim() ||
    DEFAULT_WHATSAPP_INVITE.subject;
  const bodyMd =
    (settings.whatsapp_invite_body_md ?? "").trim() ||
    DEFAULT_WHATSAPP_INVITE.bodyMd;
  const whatsappUrl = (settings.whatsapp_url ?? "").trim();
  const resolvedMd = ensureParagraphBreaks(
    applyWhatsappPlaceholders(bodyMd, { whatsappUrl }),
  );
  const bodyHtml = renderSimpleMarkdown(
    resolvedMd,
    EMAIL_LINK_ATTRS,
    EMAIL_PARAGRAPH_ATTRS,
  );

  const result = await sendTestEmail({
    to: alum.email,
    subject,
    bodyHtml,
    textFallback: resolvedMd,
    salutation: "Hi",
    includeFirstName: true,
    firstName: alum.first_name,
    logTo: { alumniId: alum.alumni_id, kind: "whatsapp_invite" },
  });
  if (!result.ok) return { ok: false, error: result.error };

  const fullName =
    [alum.first_name, alum.last_name].filter(Boolean).join(" ") ||
    alum.raw_name;

  // Enrich the admin notification with affiliation + LinkedIn-verified
  // UWC status so a non-alum (Friend / Parent) request is obvious in the
  // inbox before opening. The interesting mismatch case — self-declared
  // non-alum but LinkedIn found a UWC school in their education history
  // — is called out explicitly so the admin can follow up. No DB
  // changes: this is purely presentational.
  const flag = await classifyForAdminNotification(alum.alumni_id);
  const adminBody = [
    flag.bodyNote,
    flag.bodyNote ? "" : null,
    `Sent the WhatsApp invite email to:`,
    ``,
    `Name:    ${fullName}`,
    `Email:   ${alum.email}`,
    `College: ${alum.uwc_college ?? "—"}${alum.grad_year ? ` · ${alum.grad_year}` : ""}`,
    ``,
    `View / undo: https://uwcbayarea.org/admin/tools/whatsapp?tab=requests`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  void sendTestEmail({
    to: ADMIN_EMAIL,
    subject: `${flag.subjectPrefix}WhatsApp invite sent · ${fullName}`,
    body: adminBody,
    salutation: "",
    includeFirstName: false,
  }).then((r) => {
    if (!r.ok)
      console.warn(`[whatsapp-invite] admin notification failed: ${r.error}`);
  });
  return { ok: true };
}

/** Look up the extra fields we need to annotate the admin notification
 * — affiliation, LinkedIn-derived uwc_verified + matched school, and
 * parent-of details — and return the subject-line prefix + body note
 * that best summarizes who's requesting.
 *
 * Falls open on any DB / lookup error: returns empty prefix and no
 * note so the notification still goes out cleanly, just without the
 * annotation. */
async function classifyForAdminNotification(
  alumniId: number,
): Promise<{ subjectPrefix: string; bodyNote: string | null }> {
  try {
    const rows = (await sql`
      SELECT affiliation, uwc_verified, uwc_school_matched,
             parent_of_name, parent_of_uwc_college, parent_of_grad_year
        FROM alumni WHERE id = ${alumniId} LIMIT 1
    `) as Array<{
      affiliation: string | null;
      uwc_verified: boolean | null;
      uwc_school_matched: string | null;
      parent_of_name: string | null;
      parent_of_uwc_college: string | null;
      parent_of_grad_year: number | null;
    }>;
    const r = rows[0];
    if (!r) return { subjectPrefix: "", bodyNote: null };

    const isAlum = r.affiliation === "Alum";
    const isParent = r.affiliation === "Parent";
    const isFriend = r.affiliation === "Friend";
    const linkedinFoundUwc = r.uwc_verified === true && !!r.uwc_school_matched;

    // Alum path — no flag by default. If self-declared as Alum but
    // enrichment didn't confirm any UWC school, drop a soft note in
    // the body so the admin can decide whether it's an enrichment
    // failure (very common) or worth a light double-check.
    if (isAlum) {
      if (r.uwc_verified) return { subjectPrefix: "", bodyNote: null };
      return {
        subjectPrefix: "",
        bodyNote: `Note: self-declared as Alum but LinkedIn enrichment didn't find a UWC school in their education history. Could be an enrichment miss — verify if this looks unfamiliar.`,
      };
    }

    // Non-alum path — everyone else. Compose an affiliation summary,
    // then either flag [NON-ALUM] plainly OR upgrade to [NON-ALUM ·
    // possibly UWC alum] when LinkedIn contradicts.
    const affiliationSummary = isParent
      ? [
          `Parent of ${r.parent_of_name ?? "(child's name not given)"}`,
          r.parent_of_uwc_college ? `at ${r.parent_of_uwc_college}` : null,
          r.parent_of_grad_year ? `(grad ${r.parent_of_grad_year})` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : isFriend
      ? "Friend of UWC"
      : `Non-alum (${r.affiliation ?? "unknown affiliation"})`;

    if (linkedinFoundUwc) {
      return {
        subjectPrefix: "[NON-ALUM · possibly UWC alum] ",
        bodyNote: `⚑ ${affiliationSummary}. LinkedIn shows they attended ${r.uwc_school_matched} — worth following up to see if they should actually be listed as an alum.`,
      };
    }
    return {
      subjectPrefix: "[NON-ALUM] ",
      bodyNote: `${affiliationSummary}. LinkedIn enrichment did not find a UWC school in their education history.`,
    };
  } catch (err) {
    console.warn(`[whatsapp-invite] admin classification failed for ${alumniId}:`, err);
    return { subjectPrefix: "", bodyNote: null };
  }
}
