import { NextResponse, type NextRequest } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Resend } from "resend";
import { sql } from "@/lib/db";
import { triggerEnrichment } from "@/lib/enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Enrichment tail can run 30–90s; give the endpoint headroom in case
// the retry also runs slow.
export const maxDuration = 300;

const ADMIN_ALERT_TO = "manoloe@gmail.com";

/**
 * QStash-invoked recheck for one alumni whose signup-time enrichment
 * didn't reach a terminal state within the inline budget. Called ONCE,
 * ~15 min after signup.
 *
 * Flow:
 *   1. Verify QStash signature (rejects anyone not Upstash).
 *   2. Load the alumni row. If status is already `complete` /
 *      `needs_review` / `failed` → resolved on its own, ack + done.
 *   3. Otherwise call triggerEnrichment ONCE more. Post-call, if the
 *      row is still `pending` OR `failed`, email admin.
 */
export async function POST(req: NextRequest) {
  // Signature verification — required in prod. Missing keys in dev
  // means anyone could POST here; local dev is behind Basic auth via
  // middleware, so acceptable.
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const signature = req.headers.get("upstash-signature");
  const rawBody = await req.text();
  if (currentKey && nextKey) {
    if (!signature) {
      return NextResponse.json({ error: "missing signature" }, { status: 401 });
    }
    const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
    try {
      const isValid = await receiver.verify({
        signature,
        body: rawBody,
        url: new URL(req.url).toString(),
      });
      if (!isValid) {
        return NextResponse.json({ error: "invalid signature" }, { status: 401 });
      }
    } catch (err) {
      return NextResponse.json(
        { error: "signature verify threw", detail: String(err) },
        { status: 401 },
      );
    }
  }

  const body = JSON.parse(rawBody) as { alumni_id?: number };
  const alumniId = Number(body.alumni_id);
  if (!Number.isFinite(alumniId)) {
    return NextResponse.json({ error: "alumni_id required" }, { status: 400 });
  }

  const rows = (await sql`
    SELECT id, first_name, last_name, email, linkedin_url,
           uwc_college, grad_year, current_company,
           linkedin_enrichment_status, linkedin_enrichment_error
    FROM alumni WHERE id = ${alumniId} LIMIT 1
  `) as Array<{
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    linkedin_url: string | null;
    uwc_college: string | null;
    grad_year: number | null;
    current_company: string | null;
    linkedin_enrichment_status: string | null;
    linkedin_enrichment_error: string | null;
  }>;
  const alum = rows[0];
  if (!alum) {
    return NextResponse.json({ ok: true, resolved: "not_found" });
  }

  // Already resolved between signup and now — nothing to do.
  if (alum.linkedin_enrichment_status !== "pending") {
    return NextResponse.json({
      ok: true,
      resolved: "already_" + (alum.linkedin_enrichment_status ?? "null"),
    });
  }

  // Still pending — one more attempt.
  if (!alum.first_name || !alum.last_name) {
    await sendAdminAlert(alum, "Missing first_name/last_name — cannot re-enrich");
    return NextResponse.json({ ok: true, resolved: "missing_name" });
  }
  try {
    await triggerEnrichment(alum.id, {
      linkedin_url: alum.linkedin_url ?? undefined,
      first_name: alum.first_name,
      last_name: alum.last_name,
      email: alum.email ?? undefined,
      uwc_college: alum.uwc_college ?? undefined,
      grad_year: alum.grad_year ?? undefined,
      company: alum.current_company ?? undefined,
    });
  } catch (err) {
    console.error(`[recheck] triggerEnrichment threw for alumni ${alumniId}:`, err);
    // Fall through — check post-state below.
  }

  // Re-read to see the post-retry state.
  const [after] = (await sql`
    SELECT linkedin_enrichment_status, linkedin_enrichment_error
    FROM alumni WHERE id = ${alumniId} LIMIT 1
  `) as Array<{
    linkedin_enrichment_status: string | null;
    linkedin_enrichment_error: string | null;
  }>;
  const finalStatus = after?.linkedin_enrichment_status ?? "unknown";
  if (finalStatus === "pending" || finalStatus === "failed") {
    await sendAdminAlert(
      { ...alum, linkedin_enrichment_status: finalStatus, linkedin_enrichment_error: after?.linkedin_enrichment_error ?? null },
      `Enrichment still ${finalStatus} after retry`,
    );
  }
  return NextResponse.json({ ok: true, resolved: finalStatus });
}

async function sendAdminAlert(
  alum: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    linkedin_url: string | null;
    linkedin_enrichment_status: string | null;
    linkedin_enrichment_error: string | null;
  },
  reason: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[recheck] RESEND_API_KEY missing — cannot alert for alumni ${alum.id}`);
    return;
  }
  const name = [alum.first_name, alum.last_name].filter(Boolean).join(" ") || `alumni #${alum.id}`;
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://uwcbayarea.org";
  const adminLink = `${publicUrl}/admin/alumni/${alum.id}`;
  const subject = `[UWC BA] Enrichment stuck: ${name}`;
  const lines = [
    `Enrichment for ${name} did not complete after two attempts.`,
    ``,
    `Reason: ${reason}`,
    `Email: ${alum.email ?? "(none)"}`,
    `LinkedIn URL: ${alum.linkedin_url ?? "(none)"}`,
    `Status: ${alum.linkedin_enrichment_status ?? "(unknown)"}`,
    alum.linkedin_enrichment_error ? `Error: ${alum.linkedin_enrichment_error}` : "",
    ``,
    `Fix from admin: ${adminLink}`,
  ].filter(Boolean);
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "UWC Bay Area <manolo@uwcbayarea.org>",
      to: ADMIN_ALERT_TO,
      subject,
      text: lines.join("\n"),
    });
    console.log(`[recheck] admin alert sent for alumni ${alum.id}`);
  } catch (err) {
    console.error(`[recheck] failed to send admin alert for alumni ${alum.id}:`, err);
  }
}
