import crypto from "crypto";
import QRCode from "qrcode";

/**
 * QR token format: {attendee_id}.{event_id}.{issued_at}.{signature}
 *
 * Signature is a 12-char prefix of HMAC-SHA256(payload, QR_SIGNING_SECRET).
 * 12 hex chars = 48 bits of collision space — easily enough to spot a forged
 * scan at the door while keeping the QR payload short enough to scan fast.
 *
 * Verification is constant-time via timingSafeEqual.
 */
const SIG_LENGTH = 12;

function requireSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("QR_SIGNING_SECRET env var not set (or too short)");
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
    .slice(0, SIG_LENGTH);
}

export function generateQRToken(attendeeId: number, eventId: number): string {
  const secret = requireSecret();
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${attendeeId}.${eventId}.${issuedAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export type VerifiedQR =
  | { valid: true; attendeeId: number; eventId: number; issuedAt: number }
  | { valid: false; reason: string };

export function verifyQRToken(token: string): VerifiedQR {
  const parts = (token ?? "").trim().split(".");
  if (parts.length !== 4) return { valid: false, reason: "malformed" };
  const [aid, eid, iat, sig] = parts;
  const attendeeId = Number(aid);
  const eventId = Number(eid);
  const issuedAt = Number(iat);
  if (!Number.isFinite(attendeeId) || !Number.isFinite(eventId) || !Number.isFinite(issuedAt)) {
    return { valid: false, reason: "non-numeric" };
  }

  let secret: string;
  try {
    secret = requireSecret();
  } catch {
    return { valid: false, reason: "secret_missing" };
  }
  const payload = `${attendeeId}.${eventId}.${issuedAt}`;
  const expected = sign(payload, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad_signature" };
  }
  return { valid: true, attendeeId, eventId, issuedAt };
}

/**
 * Render the token as a base64 PNG data URL suitable for embedding in an
 * email via <img src="...">. 300×300 is enough for a phone camera to
 * read even if the email client shrinks the image.
 */
export async function renderQRDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: { dark: "#0A2540", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
}
