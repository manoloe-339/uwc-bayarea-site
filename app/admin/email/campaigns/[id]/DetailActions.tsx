"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retryFailedAction, duplicateAndRedirect } from "../actions";

export default function DetailActions({
  campaignId,
  failedCount,
  canEdit,
}: {
  campaignId: string;
  failedCount: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function retry() {
    if (failedCount === 0) return;
    setMsg(null);
    startTransition(async () => {
      const r = await retryFailedAction(campaignId);
      if (r.ok) {
        setMsg(`Retried ${r.retried}: ${r.sent} sent · ${r.failed} failed.`);
        router.refresh();
      } else {
        setMsg(`Error: ${r.error}`);
      }
    });
  }

  function dup() {
    startTransition(async () => {
      await duplicateAndRedirect(campaignId);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/admin/email/campaigns/${campaignId}/preview`}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
      >
        View email →
      </a>
      <button
        type="button"
        onClick={dup}
        disabled={pending}
        className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white disabled:opacity-50"
      >
        Duplicate
      </button>
      {failedCount > 0 && (
        <button
          type="button"
          onClick={retry}
          disabled={pending}
          className="text-sm font-semibold text-white bg-orange-600 px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
        >
          {pending ? "Retrying…" : `Retry ${failedCount} failed →`}
        </button>
      )}
      {canEdit && (
        <a
          href={`/admin/email/campaigns/${campaignId}/edit`}
          className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded"
        >
          Edit →
        </a>
      )}
      {msg && (
        <span
          className={`text-sm ${msg.startsWith("Error") ? "text-red-700" : "text-green-700"}`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
