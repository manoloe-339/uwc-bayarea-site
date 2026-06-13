"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { Redis } from "@upstash/redis";
import { normalizeCollege, isPearson } from "@/lib/uwc-colleges";
import { parseGradYear } from "@/lib/gradyear";
import { cityToRegion } from "@/lib/region";
import { sendTestEmail } from "@/lib/email-send";
import { trackClick } from "@/lib/analytics";
import { triggerEnrichment } from "@/lib/enrichment";
import { getSiteSettings, DEFAULT_SIGNUP_CONFIRMATION } from "@/lib/settings";
import {
  applyConfirmationPlaceholders,
  ensureParagraphBreaks,
  fetchCollegeAlumniCount,
} from "@/lib/signup-confirmation";
import { signWhatsappInviteToken } from "@/lib/whatsapp-invite-token";
import {
  computeSignupDiff,
  recordSignupSubmission,
  formatDiffForEmail,
  DIFFED_FIELDS,
  type SubmissionDiff,
} from "@/lib/signup-submissions";
import { normalizeLinkedinForStorage } from "@/lib/linkedin-url";
import {
  renderSimpleMarkdown,
  EMAIL_LINK_ATTRS,
  EMAIL_PARAGRAPH_ATTRS,
} from "@/lib/simple-markdown";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const RATE_LIMIT_PER_IP_PER_HOUR = 5;
const SOURCE = "signup_form";

function s(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

function num(v: FormDataEntryValue | null): number | null {
  const s2 = s(v);
  if (!s2) return null;
  const n = Number(s2);
  return Number.isFinite(n) ? n : null;
}

async function rateLimit(ipHash: string): Promise<boolean> {
  const key = `signup_ip:${ipHash}:${new Date().toISOString().slice(0, 13)}`; // per hour
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3600);
  return count <= RATE_LIMIT_PER_IP_PER_HOUR;
}

function hashIp(ip: string): string {
  // Lightweight hash — enough for rate-limit grouping, not PII storage.
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

// SignupState + INITIAL_SIGNUP_STATE live in ./state because this file
// uses "use server" — and that directive forbids any non-async-function
// export at runtime (even type-only exports survive type-stripping, but
// runtime constants like INITIAL_SIGNUP_STATE crash module load with
// "A 'use server' file can only export async functions, found object").
import type { SignupState } from "./state";

function err(error: string, field: string | null = null): SignupState {
  return { error, field };
}

export async function submitSignup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  // Honeypot — bots fill this, humans don't see it. Pretend success.
  if (s(formData.get("website"))) {
    redirect("/signup/thanks");
  }

  const firstName = s(formData.get("first_name"));
  const lastName = s(formData.get("last_name"));
  const email = s(formData.get("email"))?.toLowerCase() ?? null;
  const affiliation = s(formData.get("affiliation"));
  const consent = formData.get("consent") === "on";

  const origin = s(formData.get("origin"));

  if (!firstName || !lastName || !email || !affiliation) {
    return err(
      "Please fill in your name, email, and how you're connected to UWC.",
      !firstName ? "first_name" : !lastName ? "last_name" : !email ? "email" : "affiliation",
    );
  }
  if (!origin) {
    return err(
      "Please pick your home country from the dropdown — typing alone doesn't save it.",
      "origin",
    );
  }
  if (!consent) {
    return err(
      "We need your consent to send you UWC Bay Area emails before we can add you.",
      "consent",
    );
  }

  // Alum affiliation requires UWC college + grad year. The form has
  // browser-level `required` on these too, but enforce server-side so a
  // bot or stripped client can't bypass.
  if (affiliation === "Alum") {
    const uwcCollegeRawCheck = s(formData.get("uwc_college"));
    const gradYearRawCheck = s(formData.get("grad_year"));
    if (!uwcCollegeRawCheck || !gradYearRawCheck) {
      return err(
        "Please tell us which UWC college you attended and your graduation year.",
        !uwcCollegeRawCheck ? "uwc_college" : "grad_year",
      );
    }
  }

  const ipHeader =
    (formData.get("_ip_hint") as string | null) ?? "unknown";
  const ipHash = hashIp(ipHeader);
  const allowed = await rateLimit(ipHash);
  if (!allowed) {
    return err(
      "We've received a lot of submissions from this network. Please try again in a little while.",
      null,
    );
  }

  const uwcCollegeRaw = s(formData.get("uwc_college"));
  const uwcCollege = normalizeCollege(uwcCollegeRaw);
  const gradYearRaw = s(formData.get("grad_year"));
  const gradYear = parseGradYear(gradYearRaw, { pearson: isPearson(uwcCollege) });

  const currentCity = s(formData.get("current_city"));
  const region = cityToRegion(currentCity);
  const mobile = s(formData.get("mobile"));
  // Permissive normalize: turns "/manoloe", "linkedin.com/in/x", bare
  // slugs, regional subdomains, trailing slashes, etc. into the canonical
  // https://www.linkedin.com/in/<slug>. Returns null when the input
  // can't plausibly be a profile URL (and we just store null in that case
  // — better than persisting garbage).
  const linkedinUrl = normalizeLinkedinForStorage(formData.get("linkedin_url"));
  const company = s(formData.get("company"));
  const working = s(formData.get("working"));
  const workLocation = s(formData.get("work_location"));
  const studying = s(formData.get("studying"));
  const studyLocation = s(formData.get("study_location"));
  const nationalCommittee = s(formData.get("national_committee"));
  const howHeardRaw = s(formData.get("how_heard"));
  const howHeard = affiliation === "Friend" ? howHeardRaw : null;

  // Parent affiliation: which college / year their child attended.
  const parentOfNameRaw = s(formData.get("parent_of_name"));
  const parentOfCollegeRaw = s(formData.get("parent_of_uwc_college"));
  const parentOfCollege = normalizeCollege(parentOfCollegeRaw);
  const parentOfGradYear = parseGradYear(s(formData.get("parent_of_grad_year")), {
    pearson: isPearson(parentOfCollege),
  });
  const parentOfName = affiliation === "Parent" ? parentOfNameRaw : null;
  const parentCollegeFinal = affiliation === "Parent" ? parentOfCollege : null;
  const parentGradFinal = affiliation === "Parent" ? parentOfGradYear : null;
  const about = s(formData.get("about"));
  const questions = s(formData.get("questions"));

  const helpTagsArr = formData.getAll("help").map((v) => String(v).trim()).filter(Boolean);
  const helpTags = helpTagsArr.length ? helpTagsArr.join(", ") : null;

  // Snapshot the pre-existing alumni row (if any) BEFORE the upsert so we
  // can compute a field-by-field diff against what the user just submitted.
  // Returns null when this is a brand-new email (first signup).
  // Column list mirrors DIFFED_FIELDS; if you add a field to that const,
  // mirror it here.
  const preExisting = (
    (await sql.query(
      `SELECT first_name, last_name, mobile, linkedin_url, origin,
              uwc_college, grad_year, current_city, affiliation, company,
              help_tags, national_committee, about, questions,
              studying, study_location, working, work_location,
              parent_of_name, parent_of_uwc_college, parent_of_grad_year,
              how_heard
         FROM alumni
         WHERE email = $1
         LIMIT 1`,
      [email],
    )) as Array<Record<string, string | number | null>>
  )[0] ?? null;

  // Upsert-with-preserve: existing record's richer fields are not clobbered
  // by a later signup. We use COALESCE on UPDATE to only fill nulls.
  const upserted = (await sql`
    INSERT INTO alumni (
      first_name, last_name, email, mobile, linkedin_url, origin,
      uwc_college, uwc_college_raw, grad_year, grad_year_raw,
      current_city, region, affiliation, company,
      help_tags, national_committee, about, questions,
      studying, study_location, working, work_location,
      parent_of_name, parent_of_uwc_college, parent_of_grad_year,
      how_heard,
      subscribed, sources, flags, submitted_at, imported_at, updated_at
    ) VALUES (
      ${firstName}, ${lastName}, ${email}, ${mobile}, ${linkedinUrl}, ${origin},
      ${uwcCollege}, ${uwcCollegeRaw}, ${gradYear}, ${gradYearRaw},
      ${currentCity}, ${region}, ${affiliation}, ${company},
      ${helpTags}, ${nationalCommittee}, ${about}, ${questions},
      ${studying}, ${studyLocation}, ${working}, ${workLocation},
      ${parentOfName}, ${parentCollegeFinal}, ${parentGradFinal},
      ${howHeard},
      TRUE, ${[SOURCE]}, ${[]}, NOW(), NOW(), NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      first_name         = COALESCE(alumni.first_name, EXCLUDED.first_name),
      last_name          = COALESCE(alumni.last_name, EXCLUDED.last_name),
      mobile             = COALESCE(alumni.mobile, EXCLUDED.mobile),
      linkedin_url       = COALESCE(alumni.linkedin_url, EXCLUDED.linkedin_url),
      origin             = COALESCE(alumni.origin, EXCLUDED.origin),
      uwc_college        = COALESCE(alumni.uwc_college, EXCLUDED.uwc_college),
      uwc_college_raw    = COALESCE(alumni.uwc_college_raw, EXCLUDED.uwc_college_raw),
      grad_year          = COALESCE(alumni.grad_year, EXCLUDED.grad_year),
      grad_year_raw      = COALESCE(alumni.grad_year_raw, EXCLUDED.grad_year_raw),
      current_city       = COALESCE(alumni.current_city, EXCLUDED.current_city),
      region             = COALESCE(alumni.region, EXCLUDED.region),
      affiliation        = COALESCE(alumni.affiliation, EXCLUDED.affiliation),
      company            = COALESCE(alumni.company, EXCLUDED.company),
      help_tags          = COALESCE(alumni.help_tags, EXCLUDED.help_tags),
      national_committee = COALESCE(alumni.national_committee, EXCLUDED.national_committee),
      about              = COALESCE(alumni.about, EXCLUDED.about),
      questions          = COALESCE(alumni.questions, EXCLUDED.questions),
      studying           = COALESCE(alumni.studying, EXCLUDED.studying),
      study_location     = COALESCE(alumni.study_location, EXCLUDED.study_location),
      working            = COALESCE(alumni.working, EXCLUDED.working),
      work_location      = COALESCE(alumni.work_location, EXCLUDED.work_location),
      parent_of_name     = COALESCE(alumni.parent_of_name, EXCLUDED.parent_of_name),
      parent_of_uwc_college = COALESCE(alumni.parent_of_uwc_college, EXCLUDED.parent_of_uwc_college),
      parent_of_grad_year = COALESCE(alumni.parent_of_grad_year, EXCLUDED.parent_of_grad_year),
      how_heard          = COALESCE(alumni.how_heard, EXCLUDED.how_heard),
      submitted_at       = COALESCE(alumni.submitted_at, EXCLUDED.submitted_at),
      subscribed         = TRUE,
      unsubscribed_at    = NULL,
      unsubscribe_reason = NULL,
      unsubscribe_note   = NULL,
      sources            = (
        SELECT ARRAY(SELECT DISTINCT unnest(alumni.sources || EXCLUDED.sources))
      ),
      updated_at         = NOW()
    RETURNING id, (xmax = 0) AS inserted
  `) as { id: number; inserted: boolean }[];

  const alumniId = upserted[0].id;
  const wasNew = upserted[0].inserted;

  // Build the diff: inbound payload vs the pre-existing row state.
  // `applied = false` on a change means the user submitted a different
  // value than what's already on file, but the COALESCE-preserve upsert
  // kept the old value — the most useful signal for admin review.
  const inboundPayload = {
    first_name: firstName,
    last_name: lastName,
    mobile,
    linkedin_url: linkedinUrl,
    origin,
    uwc_college: uwcCollege,
    grad_year: gradYear,
    current_city: currentCity,
    affiliation,
    company,
    help_tags: helpTags,
    national_committee: nationalCommittee,
    about,
    questions,
    studying,
    study_location: studyLocation,
    working,
    work_location: workLocation,
    parent_of_name: parentOfName,
    parent_of_uwc_college: parentCollegeFinal,
    parent_of_grad_year: parentGradFinal,
    how_heard: howHeard,
  };
  const diff = computeSignupDiff(inboundPayload, preExisting);
  // Fire-and-forget — don't fail the signup if the recorder errors.
  recordSignupSubmission({
    alumni_id: alumniId,
    payload: inboundPayload,
    diff,
    is_resubmission: !wasNew,
  }).catch((err) => {
    console.error(`[signup] failed to record submission for ${alumniId}:`, err);
  });

  // Kick off LinkedIn auto-enrichment if we have enough to search on.
  // Uses Next 15's after() so the Railway call + polling continues to
  // run after the redirect response is sent. Plain fire-and-forget
  // (no await) inside a Server Action is fragile on Vercel — the
  // worker can tear down before the floating promise resolves.
  if (firstName && lastName && (linkedinUrl || uwcCollege || company)) {
    after(async () => {
      try {
        await triggerEnrichment(alumniId, {
          linkedin_url: linkedinUrl,
          first_name: firstName,
          last_name: lastName,
          email,
          uwc_college: uwcCollege,
          grad_year: gradYear,
          company,
        });
      } catch (err) {
        console.error(`[signup] enrichment failed for ${alumniId}:`, err);
      }
    });
  }

  // Fire analytics counter (uses the same helper our page beacons use).
  try {
    await trackClick("signup");
  } catch {
    // non-fatal
  }

  // Fire-and-forget emails (don't block the redirect on Resend latency).
  // Confirmation copy is admin-editable via /admin/tools/signup-email; we
  // fall back to DEFAULT_SIGNUP_CONFIRMATION when settings are blank.
  const settings = await getSiteSettings();
  const confirmationSubject =
    (settings.signup_confirmation_subject ?? "").trim() ||
    DEFAULT_SIGNUP_CONFIRMATION.subject;
  const confirmationMd =
    (settings.signup_confirmation_body_md ?? "").trim() ||
    DEFAULT_SIGNUP_CONFIRMATION.bodyMd;
  const collegeCount = uwcCollege
    ? await fetchCollegeAlumniCount(uwcCollege, alumniId).catch(() => 0)
    : 0;
  // Per-signup signed token so the {whatsapp_link} placeholder in
  // the confirmation email resolves to a single-click invite URL.
  // Falls back to a token-less URL if signing fails (it shouldn't —
  // DIRECTORY_PASSWORD is always set in prod — but we don't want a
  // signature failure to block the welcome email).
  const inviteToken = await signWhatsappInviteToken(alumniId).catch(() => null);
  const whatsappLink = inviteToken
    ? `https://uwcbayarea.org/join-whatsapp?invite=${encodeURIComponent(inviteToken)}`
    : `https://uwcbayarea.org/join-whatsapp`;
  const resolvedConfirmationMd = ensureParagraphBreaks(
    applyConfirmationPlaceholders(confirmationMd, {
      college: uwcCollege,
      collegeCount,
      whatsappLink,
    }),
  );
  const confirmationHtml = renderSimpleMarkdown(
    resolvedConfirmationMd,
    EMAIL_LINK_ATTRS,
    EMAIL_PARAGRAPH_ATTRS,
  );
  const adminBody = buildAdminNotificationBody({
    id: alumniId,
    firstName,
    lastName,
    email,
    affiliation,
    uwcCollege,
    gradYear,
    currentCity,
    region,
    wasNew,
    diff,
  });

  await Promise.allSettled([
    sendTestEmail({
      to: email,
      subject: confirmationSubject,
      bodyHtml: confirmationHtml,
      textFallback: resolvedConfirmationMd,
      salutation: "Hi",
      includeFirstName: true,
      firstName,
      logTo: { alumniId, kind: "signup_confirmation" },
    }).then((r) => {
      if (!r.ok) console.warn(`[signup] confirmation email failed: ${r.error}`);
    }),
    sendTestEmail({
      to: "manolo@uwcbayarea.org",
      subject: wasNew
        ? `New UWC Bay Area signup: ${firstName} ${lastName}`
        : `Updated UWC Bay Area signup: ${firstName} ${lastName}`,
      body: adminBody,
      salutation: "",
      includeFirstName: false,
    }).then((r) => {
      if (!r.ok) console.warn(`[signup] admin notification (workspace) failed: ${r.error}`);
    }),
    sendTestEmail({
      to: "manoloe@gmail.com",
      subject: wasNew
        ? `New UWC Bay Area signup: ${firstName} ${lastName}`
        : `Updated UWC Bay Area signup: ${firstName} ${lastName}`,
      body: adminBody,
      salutation: "",
      includeFirstName: false,
    }).then((r) => {
      if (!r.ok) console.warn(`[signup] admin notification (gmail) failed: ${r.error}`);
    }),
  ]);

  console.log(`[signup] ${wasNew ? "inserted" : "updated"} alumni_id=${alumniId} email=${email}`);
  redirect("/signup/thanks");
}

function buildAdminNotificationBody(r: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  affiliation: string;
  uwcCollege: string | null;
  gradYear: number | null;
  currentCity: string | null;
  region: string | null;
  wasNew: boolean;
  diff: SubmissionDiff;
}): string {
  const lines = [
    `${r.wasNew ? "New signup" : "Updated record"}: ${r.firstName} ${r.lastName}`,
    "",
    `Email:       ${r.email}`,
    `Affiliation: ${r.affiliation}`,
    `College:     ${r.uwcCollege ?? "—"}`,
    `Grad year:   ${r.gradYear ?? "—"}`,
    `City:        ${r.currentCity ?? "—"} ${r.region ? `(${r.region})` : ""}`,
  ];
  // For re-submissions, inline the field-by-field diff so the admin
  // doesn't have to click through to see what changed.
  if (!r.wasNew) {
    const diffBlock = formatDiffForEmail(r.diff);
    if (diffBlock) {
      lines.push("", diffBlock);
    }
  }
  lines.push(
    "",
    `Review re-signups: https://uwcbayarea.org/admin/tools/re-signups`,
    `View record:       https://uwcbayarea.org/admin/alumni/${r.id}`,
  );
  return lines.join("\n");
}
