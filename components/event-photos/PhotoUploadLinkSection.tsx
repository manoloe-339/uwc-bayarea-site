"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  eventId: number;
  eventSlug: string;
  eventName: string;
  initialToken: string | null;
  initialEnabled: boolean;
  appUrl: string;
};

export function PhotoUploadLinkSection({
  eventId,
  eventSlug,
  eventName,
  initialToken,
  initialEnabled,
  appUrl,
}: Props) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [enabled, setEnabled] = useState<boolean>(initialEnabled);
  const [busy, setBusy] = useState<"generate" | "toggle" | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const fullUrl = token
    ? `${appUrl.replace(/\/+$/, "")}/events/${eventSlug}/photos/upload/${token}`
    : "";

  const handleGenerate = async () => {
    if (token && !confirm("Regenerate the upload link? The old link will stop working.")) return;
    setBusy("generate");
    const res = await fetch("/api/admin/event-photos/generate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    if (res.ok) {
      const data = (await res.json()) as { token: string };
      setToken(data.token);
      setEnabled(true);
      startTransition(() => router.refresh());
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Error: ${err.error ?? res.statusText}`);
    }
    setBusy(null);
  };

  const handleToggle = async (next: boolean) => {
    setBusy("toggle");
    const res = await fetch("/api/admin/event-photos/set-enabled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, enabled: next }),
    });
    if (res.ok) {
      setEnabled(next);
      startTransition(() => router.refresh());
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Error: ${err.error ?? res.statusText}`);
    }
    setBusy(null);
  };

  const handleCopy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Could not copy. Select and copy manually.");
    }
  };

  const whatsappHref = fullUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Photos from ${eventName}? Upload them here: ${fullUrl}`
      )}`
    : "";

  const publicGalleryUrl = `${appUrl.replace(/\/+$/, "")}/events/${eventSlug}/photos`;

  return (
    <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-sans text-lg font-bold text-[color:var(--navy-ink)]">
          Photo upload link
        </h2>
        {token && (
          <label className="flex items-center gap-2 text-sm text-[color:var(--navy-ink)]">
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy !== null}
              onChange={(e) => handleToggle(e.target.checked)}
              className="accent-navy"
            />
            <span>Uploads {enabled ? "enabled" : "closed"}</span>
          </label>
        )}
      </div>

      {!token ? (
        <div>
          <p className="text-sm text-[color:var(--muted)] mb-3">
            Generate a public link attendees can use to upload photos. Photos
            land as <em>pending</em> for review.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy !== null}
            className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded hover:opacity-90 disabled:opacity-50"
          >
            {busy === "generate" ? "Generating…" : "Generate upload link"}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              readOnly
              value={fullUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 font-mono text-xs px-3 py-2 rounded border border-[color:var(--rule)] bg-[color:var(--ivory-deep,#f4f1ea)]"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs font-semibold text-navy border border-navy px-3 py-2 rounded hover:bg-navy hover:text-white"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-emerald-700 border border-emerald-700 px-3 py-1.5 rounded hover:bg-emerald-700 hover:text-white"
            >
              Share via WhatsApp
            </a>
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-navy border border-navy px-3 py-1.5 rounded hover:bg-navy hover:text-white"
            >
              Open upload page
            </a>
            <a
              href={publicGalleryUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-navy border border-navy px-3 py-1.5 rounded hover:bg-navy hover:text-white"
            >
              Open public gallery
            </a>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy !== null}
              className="text-xs font-semibold text-rose-700 border border-rose-700 px-3 py-1.5 rounded hover:bg-rose-700 hover:text-white disabled:opacity-50"
            >
              {busy === "generate" ? "Regenerating…" : "Regenerate (invalidate old)"}
            </button>
          </div>
          {!enabled && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Uploads are currently <strong>closed</strong>. Anyone with the
              link will see a "closed" message until you re-enable.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
