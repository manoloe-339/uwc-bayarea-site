"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type GenerateResult = { generated: number };
type SendResult = {
  generated: number;
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

type Props = {
  slug: string;
  totalEligible: number;
  qrGenerated: number;
  remindersSent: number;
  missingQr: number;
  unsentCount: number;
  matchedWithAlumni: number;
  guestsOnStripeEmail: number;
};

export function CommunicationsControls(props: Props) {
  const [generateConfirm, setGenerateConfirm] = useState(false);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [pending, setPending] = useState<null | "generate" | "send">(null);
  const [error, setError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const runGenerate = async () => {
    setGenerateConfirm(false);
    setPending("generate");
    setError(null);
    setGenResult(null);
    try {
      const res = await fetch(`/api/ticket-events/${props.slug}/generate-qr`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Generate failed");
      }
      const data = (await res.json()) as GenerateResult;
      setGenResult(data);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setPending(null);
    }
  };

  const runSend = async (generateMissing: boolean, includeSent: boolean) => {
    setSendConfirm(false);
    setPending("send");
    setError(null);
    setSendResult(null);
    try {
      const res = await fetch(`/api/ticket-events/${props.slug}/send-reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate_missing: generateMissing, include_sent: includeSent }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Send failed");
      }
      const data = (await res.json()) as SendResult;
      setSendResult(data);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setPending(null);
    }
  };

  const canSend =
    props.qrGenerated > 0 || props.missingQr > 0; // either have codes or can generate them on send

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setGenerateConfirm(true)}
          disabled={pending !== null || props.missingQr === 0}
          className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-navy"
        >
          Generate QR codes
          {props.missingQr > 0 && <span className="ml-1 text-xs text-[color:var(--muted)]">({props.missingQr} missing)</span>}
        </button>
        <button
          type="button"
          onClick={() => setSendConfirm(true)}
          disabled={pending !== null || !canSend}
          className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded hover:brightness-110 disabled:opacity-50"
        >
          Send reminder emails
        </button>
      </div>

      {generateConfirm && (
        <Modal title="Generate QR codes" onClose={() => setGenerateConfirm(false)}>
          <p className="text-sm mb-4">
            This will create QR codes for <strong>{props.missingQr}</strong> attendee
            {props.missingQr === 1 ? "" : "s"} without codes. Existing codes aren&rsquo;t
            touched.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setGenerateConfirm(false)} className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy">
              Cancel
            </button>
            <button type="button" onClick={runGenerate} className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold">
              Generate
            </button>
          </div>
        </Modal>
      )}

      {sendConfirm && (
        <SendConfirmModal
          unsentCount={props.unsentCount}
          missingQr={props.missingQr}
          remindersSent={props.remindersSent}
          matchedWithAlumni={props.matchedWithAlumni}
          guestsOnStripeEmail={props.guestsOnStripeEmail}
          onCancel={() => setSendConfirm(false)}
          onConfirm={runSend}
        />
      )}

      {pending === "generate" && <ProgressModal title="Generating QR codes…" />}
      {pending === "send" && <ProgressModal title="Sending reminder emails…" subtitle="Don't close this window." />}

      {genResult && !pending && (
        <ResultModal title="QR codes generated" onClose={() => setGenResult(null)}>
          <p className="text-sm">
            ✓ Created <strong>{genResult.generated}</strong> new QR code
            {genResult.generated === 1 ? "" : "s"}.
          </p>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Ready to send reminder emails.
          </p>
        </ResultModal>
      )}

      {sendResult && !pending && (
        <ResultModal title="Reminder emails sent" onClose={() => setSendResult(null)}>
          <dl className="text-sm space-y-1.5">
            <Row label="Eligible" value={sendResult.eligible} />
            {sendResult.generated > 0 && (
              <Row label="Codes generated first" value={sendResult.generated} tone="green" />
            )}
            <Row label="Sent" value={sendResult.sent} tone="green" />
            {sendResult.failed > 0 && <Row label="Failed" value={sendResult.failed} tone="red" />}
          </dl>
          {sendResult.errors.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-red-700 font-semibold">
                {sendResult.errors.length} error{sendResult.errors.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-2 space-y-1 text-red-700">
                {sendResult.errors.map((e, i) => (
                  <li key={i} className="break-words">{e}</li>
                ))}
              </ul>
            </details>
          )}
        </ResultModal>
      )}

      {error && !pending && (
        <ResultModal title="Something went wrong" onClose={() => setError(null)} danger>
          <p className="text-sm text-red-700 break-words">{error}</p>
        </ResultModal>
      )}
    </div>
  );
}

function SendConfirmModal({
  unsentCount,
  missingQr,
  remindersSent,
  matchedWithAlumni,
  guestsOnStripeEmail,
  onCancel,
  onConfirm,
}: {
  unsentCount: number;
  missingQr: number;
  remindersSent: number;
  matchedWithAlumni: number;
  guestsOnStripeEmail: number;
  onCancel: () => void;
  onConfirm: (generateMissing: boolean, includeSent: boolean) => void;
}) {
  const [includeSent, setIncludeSent] = useState(false);
  const [generateMissing, setGenerateMissing] = useState(missingQr > 0);

  return (
    <Modal title="Send reminder emails" onClose={onCancel}>
      <p className="text-sm mb-2">
        This will send to <strong>{unsentCount}</strong> attendee{unsentCount === 1 ? "" : "s"}.
      </p>
      <ul className="text-xs text-[color:var(--muted)] mb-4 space-y-0.5">
        <li>• {matchedWithAlumni} matched to alumni</li>
        <li>• {guestsOnStripeEmail} guests (Stripe email only)</li>
        {remindersSent > 0 && <li>• Already sent to {remindersSent} — skipped unless forced below</li>}
      </ul>
      {missingQr > 0 && (
        <label className="flex items-start gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={generateMissing}
            onChange={(e) => setGenerateMissing(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Generate QR codes for the <strong>{missingQr}</strong> attendee
            {missingQr === 1 ? "" : "s"} missing one first
          </span>
        </label>
      )}
      {remindersSent > 0 && (
        <label className="flex items-start gap-2 text-sm mb-4">
          <input
            type="checkbox"
            checked={includeSent}
            onChange={(e) => setIncludeSent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Also resend to the {remindersSent} who already received one (e.g. wrong date, forgot)
          </span>
        </label>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(generateMissing, includeSent)}
          className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold"
        >
          Send
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-[12px] shadow-xl p-6 w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-sans font-bold text-navy text-lg">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[color:var(--muted)] hover:text-navy text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProgressModal({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <div className="bg-white rounded-[12px] shadow-xl px-7 py-6 flex items-center gap-4 max-w-[90vw]">
        <span className="inline-block w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin shrink-0" aria-hidden />
        <div>
          <div className="font-sans font-bold text-navy text-base">{title}</div>
          {subtitle && <div className="text-xs text-[color:var(--muted)] mt-0.5">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

function ResultModal({
  title,
  children,
  onClose,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-[12px] shadow-xl p-6 w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
        <h2 className={`font-sans font-bold text-lg mb-3 ${danger ? "text-red-800" : "text-navy"}`}>
          {title}
        </h2>
        {children}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "red";
}) {
  const color =
    tone === "green" ? "text-green-700" : tone === "red" ? "text-red-700" : "text-[color:var(--navy-ink)]";
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-[color:var(--muted)]">{label}</dt>
      <dd className={`font-sans font-bold tabular-nums ${color}`}>{value.toLocaleString()}</dd>
    </div>
  );
}
