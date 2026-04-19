import crypto from "node:crypto";

// HMAC-signed unsubscribe tokens: base64url(payload) + "." + base64url(signature).
// Payload is a minimal JSON object { id, iat } so we can inspect token age later.
// Tokens never expire (people unsubscribe from old emails), but we record iat.

type Payload = { id: number; iat: number };

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s || s.length < 16) {
    throw new Error("UNSUBSCRIBE_SECRET is not set (needs at least 16 chars)");
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

export function signUnsubscribeToken(alumniId: number): string {
  const payload: Payload = { id: alumniId, iat: Math.floor(Date.now() / 1000) };
  const payloadEncoded = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = crypto.createHmac("sha256", secret()).update(payloadEncoded).digest();
  return `${payloadEncoded}.${b64url(sig)}`;
}

export function verifyUnsubscribeToken(
  token: string | null | undefined
): { ok: true; alumniId: number; ageSeconds: number } | { ok: false; reason: string } {
  if (!token || typeof token !== "string") return { ok: false, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadEncoded, sigEncoded] = parts;
  const expected = crypto.createHmac("sha256", secret()).update(payloadEncoded).digest();
  const given = b64urlDecode(sigEncoded);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return { ok: false, reason: "bad_signature" };
  }
  try {
    const payload = JSON.parse(b64urlDecode(payloadEncoded).toString("utf8")) as Payload;
    if (typeof payload.id !== "number" || typeof payload.iat !== "number") {
      return { ok: false, reason: "malformed_payload" };
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - payload.iat;
    return { ok: true, alumniId: payload.id, ageSeconds };
  } catch {
    return { ok: false, reason: "unparseable_payload" };
  }
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return email;
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}
