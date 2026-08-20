/**
 * Preflight checks run before a newsletter is sent. Deliberately
 * lightweight: no rendering the full email, just walking the draft's
 * image fields + parsing markdown image syntax, then HEADing each URL
 * to sum actual delivered bytes.
 *
 * Extensible — add new checks by pushing a Check into the returned
 * `checks` array. Client + AI tool consume the same JSON shape.
 */

import type { CampaignDraft } from "@/lib/campaign-content";
import { emailOptimizedImageUrl } from "@/lib/image-transform";
import { checkDailyQuota } from "@/lib/resend-quota";

export type CheckStatus = "ok" | "warn" | "fail";

export type Check = {
  name: string;
  status: CheckStatus;
  summary: string;
  detail?: Record<string, unknown>;
};

export type PreflightResult = {
  ok: boolean;   // true iff no fail-status checks
  checks: Check[];
};

/** Walk the draft's block image fields + parse update.body for
 *  markdown images. Returns the ORIGINAL (unoptimized) URLs so we can
 *  independently size them against what recipients will actually get. */
function collectImageUrls(draft: CampaignDraft): string[] {
  const urls: string[] = [];
  const nl = draft.newsletter;
  if (!nl) return urls;
  const pick = (u?: string | null) => { if (u && u.trim()) urls.push(u.trim()); };
  pick(nl.event?.imageUrl);
  pick(nl.update?.imageUrl);
  pick(nl.whatsNext?.imageUrl);
  pick(nl.whatsapp?.imageUrl);
  pick(nl.foodies?.imageUrl);
  // Body markdown: ![alt](url) with optional size suffix.
  const body = nl.update?.body ?? "";
  const imgRe = /!\[[^\]]*\]\(([^)\s]+)(?:\s+=[^\s)]+)?\)/g;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(body)) !== null) pick(m[1]);
  return urls;
}

async function headBytes(url: string): Promise<{ url: string; bytes: number | null; error?: string }> {
  try {
    // For Blob URLs we want the OPTIMIZED size (what the recipient
    // actually downloads). Route through the same helper the render
    // pipeline uses, treating each as a hero-width image.
    const optimized = emailOptimizedImageUrl(url, null);
    const res = await fetch(optimized, { method: "HEAD" });
    if (!res.ok) return { url, bytes: null, error: `HTTP ${res.status}` };
    const len = res.headers.get("content-length");
    return { url, bytes: len ? Number(len) : null, error: len ? undefined : "no content-length" };
  } catch (err) {
    return { url, bytes: null, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

const fmtKB = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
const fmtMB = (bytes: number) => `${(bytes / 1_000_000).toFixed(2)} MB`;

// Thresholds tuned for a well-behaved newsletter:
//   OK   — total images ≤ 500 KB (fast on mobile, comfortable)
//   WARN — 500 KB – 3 MB (slow on mobile / hotel wifi but tolerable)
//   FAIL — > 3 MB (many recipients on mobile data will bail)
const WEIGHT_WARN = 500 * 1024;
const WEIGHT_FAIL = 3 * 1_000_000;

export async function runPreflight(
  draft: CampaignDraft,
  opts: { recipientCount?: number } = {},
): Promise<PreflightResult> {
  const checks: Check[] = [];

  // ── Check: Resend daily quota ────────────────────────────────────
  // Skip when recipientCount isn't known (e.g. AI tool call without
  // context). When known, we compare pending-send against remaining
  // quota so the admin sees this BEFORE clicking Send.
  if (typeof opts.recipientCount === "number" && opts.recipientCount > 0) {
    const q = await checkDailyQuota(opts.recipientCount);
    const status: CheckStatus = q.wouldExceed
      ? "fail"
      : q.remaining - q.pending < Math.max(20, q.cap * 0.1)
        ? "warn"
        : "ok";
    const summary = q.wouldExceed
      ? `${q.pending} recipients but only ${q.remaining} of ${q.cap} left today — ${q.overageIfSent} would fail. Resets at ${q.resetsAtUtc.replace("T", " ").slice(0, 16)} UTC.`
      : `${q.pending} recipients · ${q.remaining} of ${q.cap} remaining today (${q.usedToday} already sent).`;
    checks.push({
      name: "resend_daily_quota",
      status,
      summary,
      detail: {
        cap: q.cap,
        used_today: q.usedToday,
        remaining: q.remaining,
        pending: q.pending,
        would_exceed: q.wouldExceed,
        overage_if_sent: q.overageIfSent,
        resets_at_utc: q.resetsAtUtc,
      },
    });
  }

  // ── Check: email weight (image bytes) ────────────────────────────
  const urls = collectImageUrls(draft);
  const sized = await Promise.all(urls.map(headBytes));
  const totalBytes = sized.reduce((s, r) => s + (r.bytes ?? 0), 0);
  const knownCount = sized.filter((r) => r.bytes != null).length;
  const errors = sized.filter((r) => r.error);
  const weightStatus: CheckStatus =
    totalBytes > WEIGHT_FAIL ? "fail" : totalBytes > WEIGHT_WARN ? "warn" : "ok";
  const summaryParts: string[] = [];
  if (urls.length === 0) {
    summaryParts.push("no images in this draft");
  } else {
    summaryParts.push(
      `${sized.length} image${sized.length === 1 ? "" : "s"} · total ${totalBytes >= 1_000_000 ? fmtMB(totalBytes) : fmtKB(totalBytes)}`,
    );
    if (knownCount < sized.length) {
      summaryParts.push(`${sized.length - knownCount} unmeasured`);
    }
  }
  if (weightStatus === "warn") summaryParts.push("(mobile users may find this slow)");
  if (weightStatus === "fail") summaryParts.push("(too heavy for mobile — consider fewer images)");
  checks.push({
    name: "email_weight",
    status: weightStatus,
    summary: summaryParts.join(" · "),
    detail: {
      total_bytes: totalBytes,
      image_count: urls.length,
      per_image: sized.map((r) => ({
        url: r.url,
        bytes: r.bytes,
        error: r.error,
      })),
      warn_threshold_bytes: WEIGHT_WARN,
      fail_threshold_bytes: WEIGHT_FAIL,
    },
  });
  if (errors.length) {
    checks.push({
      name: "image_fetch_errors",
      status: "warn",
      summary: `${errors.length} image URL${errors.length === 1 ? "" : "s"} couldn't be measured`,
      detail: { errors: errors.map((e) => ({ url: e.url, error: e.error })) },
    });
  }

  return {
    ok: checks.every((c) => c.status !== "fail"),
    checks,
  };
}
