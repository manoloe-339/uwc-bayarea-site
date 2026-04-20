"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { Redis } from "@upstash/redis";
import { normalizeCollege, isPearson } from "@/lib/uwc-colleges";
import { parseGradYear } from "@/lib/gradyear";
import { cityToRegion } from "@/lib/region";
import { sendTestEmail } from "@/lib/email-send";
import { trackClick } from "@/lib/analytics";

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

export async function submitSignup(formData: FormData): Promise<void> {
  // Honeypot — bots fill this, humans don't see it.
  if (s(formData.get("website"))) {
    redirect("/signup/thanks");
  }

  const firstName = s(formData.get("first_name"));
  const lastName = s(formData.get("last_name"));
  const email = s(formData.get("email"))?.toLowerCase() ?? null;
  const affiliation = s(formData.get("affiliation"));
  const consent = formData.get("consent") === "on";

  if (!firstName || !lastName || !email || !affiliation) {
    redirect("/signup?error=missing_required");
  }
  if (!consent) {
    redirect("/signup?error=consent_required");
  }

  const ipHeader =
    (formData.get("_ip_hint") as string | null) ?? "unknown";
  const ipHash = hashIp(ipHeader);
  const allowed = await rateLimit(ipHash);
  if (!allowed) {
    redirect("/signup?error=rate_limit");
  }

  const uwcCollegeRaw = s(formData.get("uwc_college"));
  const uwcCollege = normalizeCollege(uwcCollegeRaw);
  const gradYearRaw = s(formData.get("grad_year"));
  const gradYear = parseGradYear(gradYearRaw, { pearson: isPearson(uwcCollege) });

  const currentCity = s(formData.get("current_city"));
  const region = cityToRegion(currentCity);
  const mobile = s(formData.get("mobile"));
  const linkedinUrl = s(formData.get("linkedin_url"));
  const origin = s(formData.get("origin"));
  const company = s(formData.get("company"));
  const working = s(formData.get("working"));
  const studying = s(formData.get("studying"));
  const nationalCommittee = s(formData.get("national_committee"));
  const about = s(formData.get("about"));
  const questions = s(formData.get("questions"));

  const helpTagsArr = formData.getAll("help").map((v) => String(v).trim()).filter(Boolean);
  const helpTags = helpTagsArr.length ? helpTagsArr.join(", ") : null;

  // Upsert-with-preserve: existing record's richer fields are not clobbered
  // by a later signup. We use COALESCE on UPDATE to only fill nulls.
  const upserted = (await sql`
    INSERT INTO alumni (
      first_name, last_name, email, mobile, linkedin_url, origin,
      uwc_college, uwc_college_raw, grad_year, grad_year_raw,
      current_city, region, affiliation, company,
      help_tags, national_committee, about, questions,
      studying, working, subscribed, sources, flags, imported_at, updated_at
    ) VALUES (
      ${firstName}, ${lastName}, ${email}, ${mobile}, ${linkedinUrl}, ${origin},
      ${uwcCollege}, ${uwcCollegeRaw}, ${gradYear}, ${gradYearRaw},
      ${currentCity}, ${region}, ${affiliation}, ${company},
      ${helpTags}, ${nationalCommittee}, ${about}, ${questions},
      ${studying}, ${working}, TRUE, ${[SOURCE]}, ${[]}, NOW(), NOW()
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
      working            = COALESCE(alumni.working, EXCLUDED.working),
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

  // Fire analytics counter (uses the same helper our page beacons use).
  try {
    await trackClick("signup");
  } catch {
    // non-fatal
  }

  // Fire-and-forget emails (don't block the redirect on Resend latency).
  const confirmation = buildConfirmationBody(firstName);
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
  });

  await Promise.allSettled([
    sendTestEmail({
      to: email,
      subject: "Welcome to UWC Bay Area",
      body: confirmation,
      salutation: "Hi",
      includeFirstName: true,
      firstName,
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

function buildConfirmationBody(_firstName: string): string {
  return `Thanks for signing up with UWC Bay Area.

We've saved your details. You'll hear from us when we're organizing events or have news worth sharing — usually not more than once or twice a month.

You can reply to this email any time (it'll reach our team directly), and every message we send has an unsubscribe link at the bottom.

Looking forward to connecting,
UWC Bay Area`;
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
}): string {
  const lines = [
    `${r.wasNew ? "New signup" : "Updated record"}: ${r.firstName} ${r.lastName}`,
    "",
    `Email:       ${r.email}`,
    `Affiliation: ${r.affiliation}`,
    `College:     ${r.uwcCollege ?? "—"}`,
    `Grad year:   ${r.gradYear ?? "—"}`,
    `City:        ${r.currentCity ?? "—"} ${r.region ? `(${r.region})` : ""}`,
    "",
    `View record: https://uwcbayarea.org/admin/alumni/${r.id}`,
  ];
  return lines.join("\n");
}
