"use client";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type FileStatus = {
  id: string;
  name: string;
  size: number;
  progress: number;
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
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

export function AttendeePhotoUploadZone({ token }: { token: string }) {
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
      } else if (f.size > 25 * 1024 * 1024) {
        rejected.push({ ...item, status: "error", error: "File too large (>25MB)" });
      } else {
        accepted.push({ item, file: f });
      }
    }

    setItems((prev) => [...prev, ...accepted.map((a) => a.item), ...rejected]);

    const concurrency = 3;
    let cursor = 0;
    const workers: Promise<void>[] = [];

    const next = async (): Promise<void> => {
      while (cursor < accepted.length) {
        const idx = cursor++;
        const { item, file } = accepted[idx];
        update(item.id, { status: "uploading" });
        try {
          await upload(`events/uploads/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/event-photos/attendee-upload",
            clientPayload: JSON.stringify({
              token,
              originalFilename: file.name,
              contentType: file.type || null,
            }),
            onUploadProgress: ({ percentage }) => {
              update(item.id, { progress: Math.round(percentage) });
            },
          });
          update(item.id, { status: "done", progress: 100 });
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
    e.target.value = "";
  };

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-[10px] p-8 text-center transition-colors ${
          dragOver ? "border-navy bg-navy/5" : "border-[color:var(--rule)] bg-white"
        }`}
      >
        <p className="text-base text-[color:var(--navy-ink)] mb-1">
          Drag photos here, or
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-2 text-sm font-semibold text-white bg-navy px-5 py-2.5 rounded hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Choose photos"}
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
          JPG · PNG · WEBP · GIF · HEIC — up to 25MB each
        </p>
      </div>

      {doneCount > 0 && !busy && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-[10px] p-4 text-sm text-emerald-900">
          <strong>Thanks!</strong> {doneCount} photo{doneCount === 1 ? "" : "s"} uploaded.
          They'll be reviewed before appearing in the gallery. Feel free to upload more.
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-3 bg-white border border-[color:var(--rule)] rounded-[10px]">
          <div className="px-4 py-2 flex items-center justify-between border-b border-[color:var(--rule)]">
            <span className="text-xs font-semibold text-[color:var(--navy-ink)]">
              {doneCount} / {items.length} uploaded
              {errorCount > 0 ? ` · ${errorCount} failed` : ""}
            </span>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((it) => it.status !== "done"))}
              className="text-xs text-[color:var(--muted)] hover:text-navy"
            >
              Clear completed
            </button>
          </div>
          <ul className="divide-y divide-[color:var(--rule)] max-h-72 overflow-y-auto">
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
