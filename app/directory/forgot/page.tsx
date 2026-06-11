import type { Metadata } from "next";
import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset directory password · UWC Bay Area",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Plain page (no animated backdrop — this isn't the welcome
 * moment, just a utility flow). Submits a one-off email request
 * that triggers a fresh setup-token send via /api/directory/forgot. */
export default function ForgotPasswordPage() {
  return (
    <div
      className="min-h-[100dvh] relative isolate flex items-center justify-center px-5 py-12"
      style={{ background: "var(--rich-deep)" }}
    >
      <div
        className="w-full max-w-[380px] rounded-[12px] p-6 sm:p-7"
        style={{
          background: "rgba(255,255,255,.97)",
          border: "1px solid rgba(11,37,69,.08)",
          boxShadow:
            "0 2px 0 var(--ivory-3), 0 30px 60px -30px rgba(11,37,69,.5)",
        }}
      >
        <div className="flex items-center gap-2 text-navy font-bold text-[10px] tracking-[.22em] uppercase">
          <span className="inline-block w-5 h-0.5 bg-navy" aria-hidden />
          Reset password
        </div>
        <h1
          className="text-[color:var(--navy-ink)] mt-2 font-extrabold leading-[1.04]"
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "clamp(22px, 5vw, 28px)",
            letterSpacing: "-.025em",
          }}
        >
          Forgot your password?
        </h1>
        <p className="text-[color:var(--muted)] text-[12px] leading-snug mt-2">
          Enter the email your invite came to and we&rsquo;ll send a fresh
          link to set a new password.
        </p>
        <div className="mt-4">
          <ForgotPasswordForm />
        </div>
        <div className="mt-5 text-[12px]">
          <Link
            href="/directory/login"
            className="text-navy hover:underline"
          >
            ← Back to sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}
