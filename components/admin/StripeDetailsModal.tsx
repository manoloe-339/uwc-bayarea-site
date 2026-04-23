"use client";

type CustomFieldEntry = {
  key?: string;
  label?: { custom?: string } | null;
  text?: { value?: string | null } | null;
  dropdown?: { value?: string | null } | null;
  numeric?: { value?: string | null } | null;
};

type Props = {
  sessionId: string | null;
  paymentIntentId: string | null;
  amountPaid: string | number;
  paidAt: string | null;
  refundStatus: string | null;
  customFields: unknown;
  onClose: () => void;
};

export function StripeDetailsModal({
  sessionId,
  paymentIntentId,
  amountPaid,
  paidAt,
  refundStatus,
  customFields,
  onClose,
}: Props) {
  const fields = Array.isArray(customFields) ? (customFields as CustomFieldEntry[]) : [];
  const dashUrl = paymentIntentId
    ? `https://dashboard.stripe.com/payments/${paymentIntentId}`
    : sessionId
      ? `https://dashboard.stripe.com/checkout/sessions/${sessionId}`
      : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-[12px] shadow-xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
        <h2 className="font-sans font-bold text-navy text-lg mb-4">Stripe payment details</h2>

        <dl className="text-sm space-y-2">
          <Row label="Session ID" value={sessionId ?? "—"} mono />
          <Row label="Payment intent" value={paymentIntentId ?? "—"} mono />
          <Row label="Amount paid" value={`$${Number(amountPaid || 0).toFixed(2)}`} />
          <Row
            label="Payment date"
            value={
              paidAt
                ? new Date(paidAt).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
          <Row
            label="Refund status"
            value={
              refundStatus === "refunded"
                ? "Refunded"
                : refundStatus === "partially_refunded"
                  ? "Partially refunded"
                  : "Not refunded"
            }
            tone={refundStatus ? "red" : undefined}
          />
        </dl>

        {fields.length > 0 && (
          <div className="mt-5">
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-2">
              Custom fields
            </div>
            <dl className="text-sm space-y-1.5">
              {fields.map((f, i) => {
                const label = f.label?.custom ?? f.key ?? `Field ${i + 1}`;
                const value =
                  f.text?.value ?? f.dropdown?.value ?? f.numeric?.value ?? null;
                return (
                  <div key={i} className="flex flex-wrap gap-x-2">
                    <dt className="text-[color:var(--muted)]">{label}:</dt>
                    <dd className="text-[color:var(--navy-ink)] break-words">
                      {value && value.trim() ? (
                        <span className="font-semibold">&ldquo;{value}&rdquo;</span>
                      ) : (
                        <span className="italic text-[color:var(--muted)]">blank</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {dashUrl ? (
            <a
              href={dashUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-navy hover:underline"
            >
              View in Stripe Dashboard →
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
          >
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
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "red";
}) {
  return (
    <div className="flex flex-wrap gap-x-2 items-baseline">
      <dt className="text-[color:var(--muted)] min-w-[110px]">{label}:</dt>
      <dd
        className={`${mono ? "font-mono text-xs" : ""} ${
          tone === "red" ? "text-red-700 font-semibold" : "text-[color:var(--navy-ink)]"
        } break-all`}
      >
        {value}
      </dd>
    </div>
  );
}
