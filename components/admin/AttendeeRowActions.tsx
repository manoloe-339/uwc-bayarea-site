"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MatchReviewModal } from "./MatchReviewModal";
import { LinkToAlumniModal } from "./LinkToAlumniModal";
import { StripeDetailsModal } from "./StripeDetailsModal";
import { SignupInviteModal } from "./SignupInviteModal";

type Props = {
  attendeeId: number;
  initialNotes: string | null;
  initialStarred: boolean;
  initialFollowup: boolean;
  alumniId: number | null;
  stripeName: string | null;
  stripeEmail: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomFields: unknown;
  amountPaid: string;
  paidAt: string | null;
  refundStatus: string | null;
  matchReason: string | null;
  isManualMatch: boolean;
  isStripePurchase: boolean;
  attendeeType: "paid" | "comp" | "walk-in";
  displayName: string;
  associatedAlumniId: number | null;
  associatedName: string | null;
  relationshipType: string | null;
  isPotentialDonor: boolean;
  // UWC invite prerequisites
  uwcAffiliation: string | null;
  eventName: string;
  signupInviteSentAt: string | null;
  canInvite: boolean;
  // QR reminder
  reminderRecipient: string | null;
  qrCodeSentAt: string | null;
};

export function AttendeeRowActions(props: Props) {
  const {
    attendeeId,
    initialNotes,
    initialStarred,
    initialFollowup,
    alumniId,
    stripeName,
    stripeEmail,
    stripeSessionId,
    stripePaymentIntentId,
    stripeCustomFields,
    amountPaid,
    paidAt,
    refundStatus,
    matchReason,
    isManualMatch,
    isStripePurchase,
    attendeeType,
    displayName,
    associatedAlumniId,
    associatedName,
    relationshipType,
    isPotentialDonor,
    uwcAffiliation,
    eventName,
    signupInviteSentAt,
    canInvite,
    reminderRecipient,
    qrCodeSentAt,
  } = props;

  const [starred, setStarred] = useState(initialStarred);
  const [followup, setFollowup] = useState(initialFollowup);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [stripeOpen, setStripeOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sendQrOpen, setSendQrOpen] = useState(false);
  const [sendingQr, setSendingQr] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const patch = async (body: Record<string, unknown>) => {
    await fetch(`/api/ticket-events/attendees/${attendeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    startTransition(() => router.refresh());
  };

  const toggleStar = async () => {
    const next = !starred;
    setStarred(next);
    await patch({ is_starred: next });
  };
  const toggleFollowup = async () => {
    const next = !followup;
    setFollowup(next);
    await patch({ needs_followup: next });
  };
  const saveNotes = async () => {
    await patch({ notes: notes.trim() || null });
    setEditingNotes(false);
  };
  const removeFromEvent = async () => {
    if (!confirm("Remove this person from the event? (Soft delete — won't reappear on next sync.)")) return;
    await patch({ delete: true });
    setMenuOpen(false);
  };
  const sendQr = async () => {
    setSendQrOpen(false);
    setSendingQr(true);
    try {
      const res = await fetch(`/api/ticket-events/attendees/${attendeeId}/send-qr`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Send failed");
      }
      const body = (await res.json()) as { to: string };
      setToast({ msg: `QR code sent to ${body.to}`, tone: "ok" });
      startTransition(() => router.refresh());
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Send failed", tone: "err" });
    } finally {
      setSendingQr(false);
    }
  };

  const canSendQr =
    (attendeeType === "paid" || attendeeType === "comp") && !!reminderRecipient;

  const rematch = async () => {
    const res = await fetch(`/api/ticket-events/attendees/${attendeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rematch: true }),
    });
    setMenuOpen(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Rematch failed");
      return;
    }
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex items-start gap-1 shrink-0">
      <button
        type="button"
        onClick={toggleStar}
        aria-label={starred ? "Remove star" : "Star attendee"}
        title={starred ? "Remove star" : "Star attendee"}
        className={`p-1.5 rounded hover:bg-ivory-2 ${starred ? "text-amber-500" : "text-[color:var(--muted)]"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
      <button
        type="button"
        onClick={toggleFollowup}
        aria-label={followup ? "Clear follow-up flag" : "Flag for follow-up"}
        title={followup ? "Clear follow-up flag" : "Flag for follow-up"}
        className={`p-1.5 rounded hover:bg-ivory-2 ${followup ? "text-orange-600" : "text-[color:var(--muted)]"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={followup ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </button>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More actions"
          className="p-1.5 rounded hover:bg-ivory-2 text-[color:var(--muted)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="19" cy="12" r="1.75" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[color:var(--rule)] rounded-[8px] shadow-lg py-1 text-sm z-10">
            <MenuItem onClick={() => { setEditingNotes(true); setMenuOpen(false); }}>
              {notes ? "Edit notes" : "Add notes"}
            </MenuItem>
            <MenuItem onClick={() => { setLinkOpen(true); setMenuOpen(false); }}>
              {associatedAlumniId ? "Edit association" : "Link to alumni"}
            </MenuItem>
            {canInvite && (
              <MenuItem onClick={() => { setInviteOpen(true); setMenuOpen(false); }}>
                {signupInviteSentAt ? "Resend invite" : "Invite to signup"}
              </MenuItem>
            )}
            {canSendQr && (
              <MenuItem onClick={() => { setSendQrOpen(true); setMenuOpen(false); }}>
                {qrCodeSentAt ? "Resend QR code" : "Send QR code"}
              </MenuItem>
            )}
            {isStripePurchase && (
              <MenuItem onClick={() => { setStripeOpen(true); setMenuOpen(false); }}>
                View Stripe details
              </MenuItem>
            )}
            <MenuItem onClick={() => { setMatchOpen(true); setMenuOpen(false); }}>
              {alumniId ? "Change match" : "Pick match"}
            </MenuItem>
            {isStripePurchase && (
              <MenuItem
                onClick={rematch}
                disabled={isManualMatch}
                title={isManualMatch ? "Admin-confirmed match — clear it to rematch" : undefined}
              >
                Rematch
              </MenuItem>
            )}
            <MenuItem onClick={removeFromEvent} danger>
              Remove from event
            </MenuItem>
          </div>
        )}
      </div>

      {matchOpen && (
        <MatchReviewModal
          attendeeId={attendeeId}
          currentAlumniId={alumniId}
          stripeName={stripeName}
          stripeEmail={stripeEmail}
          matchReason={matchReason}
          onClose={() => setMatchOpen(false)}
        />
      )}

      {linkOpen && (
        <LinkToAlumniModal
          attendeeId={attendeeId}
          displayName={displayName}
          initialAssociatedAlumniId={associatedAlumniId}
          initialAssociatedName={associatedName}
          initialRelationshipType={relationshipType}
          initialIsPotentialDonor={isPotentialDonor}
          onClose={() => setLinkOpen(false)}
        />
      )}

      {stripeOpen && (
        <StripeDetailsModal
          sessionId={stripeSessionId}
          paymentIntentId={stripePaymentIntentId}
          amountPaid={amountPaid}
          paidAt={paidAt}
          refundStatus={refundStatus}
          customFields={stripeCustomFields}
          onClose={() => setStripeOpen(false)}
        />
      )}

      {inviteOpen && canInvite && (
        <SignupInviteModal
          attendeeId={attendeeId}
          to={stripeEmail ?? ""}
          firstName={firstNameFromDisplay(displayName)}
          eventName={eventName}
          uwcAffiliation={uwcAffiliation}
          alreadySentAt={signupInviteSentAt}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {sendQrOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-[12px] shadow-xl p-6 w-full max-w-[440px]">
            <h2 className="font-sans font-bold text-navy text-lg mb-1">
              {qrCodeSentAt ? "Resend QR code" : "Send QR code"}
            </h2>
            <p className="text-xs text-[color:var(--muted)] mb-4">
              Generates a QR code if one doesn&rsquo;t exist yet, then sends the
              reminder email to this attendee.
            </p>
            <dl className="text-sm space-y-1.5 mb-4">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[color:var(--muted)]">To</dt>
                <dd className="font-semibold text-navy break-all text-right">{reminderRecipient}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[color:var(--muted)]">Last sent</dt>
                <dd className="text-[color:var(--navy-ink)]">
                  {qrCodeSentAt
                    ? new Date(qrCodeSentAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Never"}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSendQrOpen(false)}
                className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendQr}
                className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {sendingQr && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white rounded-[12px] shadow-xl px-6 py-5 flex items-center gap-3">
            <span className="inline-block w-5 h-5 border-[3px] border-navy border-t-transparent rounded-full animate-spin" aria-hidden />
            <span className="font-semibold text-navy text-sm">Sending QR code…</span>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[70] rounded-[10px] shadow-lg px-4 py-3 text-sm font-semibold max-w-[320px] ${
            toast.tone === "ok"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.tone === "ok" ? "✓ " : "✗ "}
          {toast.msg}
        </div>
      )}

      {editingNotes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white rounded-[12px] shadow-xl p-5 w-[90vw] max-w-[440px]">
            <h3 className="font-sans font-bold text-navy text-base mb-2">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
              rows={5}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
              placeholder="e.g. Sister of Alex Doe, bringing husband as plus-one"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNotes(initialNotes ?? "");
                  setEditingNotes(false);
                }}
                className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNotes}
                className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  danger,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`block w-full text-left px-3 py-2 hover:bg-ivory-2 disabled:text-[color:var(--muted)] disabled:cursor-not-allowed disabled:hover:bg-transparent ${
        danger ? "text-red-700" : ""
      }`}
    >
      {children}
    </button>
  );
}

function firstNameFromDisplay(name: string): string | null {
  const first = name.trim().split(/\s+/)[0];
  return first || null;
}
