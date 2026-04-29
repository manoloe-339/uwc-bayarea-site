"use client";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type FileStatus = {
  id: string;
  name: string;
  size: number;
  progress: number; // 0..100
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

function isAllowed(file: File): boolean {
  if (file.type && ALLOWED.includes(file.type.toLowerCase())) return true;
  // Some browsers report empty type for HEIC; allow by extension as fallback.
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

export function PhotoUploadZone({
  eventId,
  onUploaded,
}: {
  eventId: number;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<FileStatus[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (id: string, patch: Partial<FileStatus>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);

    const accepted: { item: FileStatus; file: File }[] = [];
    const rejected: FileStatus[] = [];

    for (const f of files) {
      const id = `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 6)}`;
      const item: FileStatus = {
        id,
        name: f.name,
        size: f.size,
        progress: 0,
        status: "queued",
      };
      if (!isAllowed(f)) {
        rejected.push({ ...item, status: "error", error: "Unsupported type" });
      } else {
        accepted.push({ item, file: f });
      }
    }

    setItems((prev) => [...prev, ...accepted.map((a) => a.item), ...rejected]);

    let completedAny = false;
    const concurrency = 3;
    let cursor = 0;
    const workers: Promise<void>[] = [];

    const next = async (): Promise<void> => {
      while (cursor < accepted.length) {
        const idx = cursor++;
        const { item, file } = accepted[idx];
        update(item.id, { status: "uploading" });
        try {
          await upload(`events/${eventId}/photos/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/admin/event-photos/upload",
            clientPayload: JSON.stringify({
              eventId,
              originalFilename: file.name,
              contentType: file.type || null,
            }),
            onUploadProgress: ({ percentage }) => {
              update(item.id, { progress: Math.round(percentage) });
            },
          });
          update(item.id, { status: "done", progress: 100 });
          completedAny = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          update(item.id, { status: "error", error: msg });
        }
      }
    };

    for (let i = 0; i < Math.min(concurrency, accepted.length); i++) {
      workers.push(next());
    }
    await Promise.all(workers);

    setBusy(false);
    if (completedAny) {
      // The blob upload finishes before Vercel's onUploadCompleted webhook
      // fires server-side — and HEIC conversion adds another ~1-3s on top
      // of that. So we refresh several times over the next 12 seconds to
      // pick up rows as the webhook records them. Each refresh is cheap
      // (force-dynamic page, single SQL query).
      const delays = [1500, 3500, 6000, 9000, 12000];
      delays.forEach((d) => setTimeout(onUploaded, d));
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    void handleFiles(files);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    void handleFiles(files);
    // reset so picking the same file again retriggers
    e.target.value = "";
  };

  const clearDone = () => {
    setItems((prev) => prev.filter((it) => it.status !== "done"));
  };

  return (
    <div className="mb-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-[10px] p-6 text-center transition-colors ${
          dragOver ? "border-navy bg-navy/5" : "border-[color:var(--rule)] bg-white"
        }`}
      >
        <p className="text-sm text-[color:var(--muted)] mb-3">
          Drag photos here, or
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Choose files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={onPick}
        />
        <p className="text-xs text-[color:var(--muted)] mt-3">
          JPG · PNG · WEBP · GIF · HEIC (auto-converted to JPEG) · up to 25MB each
        </p>
      </div>

      {items.length > 0 && (
        <div className="mt-3 bg-white border border-[color:var(--rule)] rounded-[10px]">
          <div className="px-4 py-2 flex items-center justify-between border-b border-[color:var(--rule)]">
            <span className="text-xs font-semibold text-[color:var(--navy-ink)]">
              {items.filter((i) => i.status === "done").length} / {items.length} uploaded
            </span>
            <button
              type="button"
              onClick={clearDone}
              className="text-xs text-[color:var(--muted)] hover:text-navy"
            >
              Clear completed
            </button>
          </div>
          <ul className="divide-y divide-[color:var(--rule)]">
            {items.map((it) => (
              <li key={it.id} className="px-4 py-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate flex-1" title={it.name}>{it.name}</span>
                  <span className="text-[color:var(--muted)] tabular-nums">
                    {(it.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                  <span
                    className={`tabular-nums w-24 text-right ${
                      it.status === "error"
                        ? "text-rose-700"
                        : it.status === "done"
                        ? "text-emerald-700"
                        : "text-[color:var(--muted)]"
                    }`}
                  >
                    {it.status === "error"
                      ? it.error ?? "Error"
                      : it.status === "done"
                      ? "Done"
                      : it.status === "uploading"
                      ? `${it.progress}%`
                      : "Queued"}
                  </span>
                </div>
                {it.status === "uploading" && (
                  <div className="mt-1 h-1 bg-[color:var(--rule)] rounded overflow-hidden">
                    <div
                      className="h-full bg-navy transition-[width]"
                      style={{ width: `${it.progress}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
