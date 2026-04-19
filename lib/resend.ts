import { Resend } from "resend";

let client: Resend | null = null;

export function getResend(): Resend {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  client = new Resend(key);
  return client;
}

export function fromAddress(): string {
  const v = process.env.RESEND_FROM_EMAIL;
  if (!v) throw new Error("RESEND_FROM_EMAIL is not set");
  return v;
}

export function replyToAddress(): string | undefined {
  return process.env.RESEND_REPLY_TO || undefined;
}
