"use client";

import { useEffect, useMemo, useState } from "react";
import CropEditor from "@/components/admin/CropEditor";

/** Photo referenced in the draft, with lookup status from event_photos. */
type PhotoRow = {
  url: string;
  /** DB match: null if this URL isn't an event_photos row (external URL,
   *  temp upload, etc.) — can't be adjusted, just shown as unadjustable. */
  photoId: number | null;
  focalX: number | null;
  focalY: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** The current draft's update.body markdown, source of truth for
   *  which images need adjustment. */
  bodyMarkdown: string;
  /** Called with the rewritten body (with focal params injected on any
   *  image whose focal the admin just changed). Compose form merges it
   *  into the draft + autosaves. */
  onBodyUpdate: (nextBody: string) => void;
};

/** Walk the markdown for image URLs. Returns unique URLs in order. */
function extractImageUrls(md: string): string[] {
  const re = /!\[[^\]]*\]\(([^)\s]+)/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

/** Rewrite every markdown line that references `url` to have (or
 *  update) the `focal=X,Y` suffix. Preserves existing `=W` / `=W%`
 *  sizing.
 *
 *   ![alt](url =48%)             → ![alt](url =48% focal=30,60)
 *   ![alt](url =48% focal=A,B)   → ![alt](url =48% focal=30,60)
 *   ![alt](url)                  → ![alt](url focal=30,60)
 */
function rewriteFocalInMarkdown(md: string, url: string, x: number, y: number): string {
  // Escape URL for regex.
  const urlEsc = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match the FULL image markdown for this URL, capturing an optional
  // size suffix and an optional existing focal suffix.
  const re = new RegExp(
    `(!\\[[^\\]]*\\]\\(${urlEsc})(\\s+=\\d+%?(?:x\\d+)?)?(\\s+focal=\\d+,\\d+)?\\)`,
    "g",
  );
  return md.replace(re, (_full, prefix, size, _focal) => {
    return `${prefix}${size ?? ""} focal=${Math.round(x)},${Math.round(y)})`;
  });
}

export default function AdjustPhotosModal({ open, onClose, bodyMarkdown, onBodyUpdate }: Props) {
  const urls = useMemo(() => extractImageUrls(bodyMarkdown), [bodyMarkdown]);
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PhotoRow | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  // Load focal lookup whenever the modal opens with a new URL set.
  // Auto-inject any saved focals into the markdown for photos that
  // have a saved focal but haven't been given one in this draft yet
  // (this is how cross-newsletter reuse works — once you've adjusted
  // a photo, the next newsletter using it picks up the crop).
  useEffect(() => {
    if (!open || urls.length === 0) {
      setRows([]);
      return;
    }
    setLoading(true);
    const qs = urls.map((u) => `url=${encodeURIComponent(u)}`).join("&");
    fetch(`/api/newsletter-ai/photo-focal?${qs}`)
      .then((r) => r.json())
      .then((data: { focals: Array<{ blob_url: string; photo_id: number; focal_x: number | null; focal_y: number | null }> }) => {
        const byUrl = new Map(data.focals.map((f) => [f.blob_url, f]));
        setRows(
          urls.map((url) => {
            const f = byUrl.get(url);
            return {
              url,
              photoId: f?.photo_id ?? null,
              focalX: f?.focal_x ?? null,
              focalY: f?.focal_y ?? null,
            };
          }),
        );
        // Auto-apply any saved focals that aren't yet in the markdown.
        let nextBody = bodyMarkdown;
        let touched = false;
        for (const [url, f] of byUrl.entries()) {
          if (f.focal_x == null || f.focal_y == null) continue;
          const alreadyHasFocal = new RegExp(
            `\\(${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^)]*focal=`,
          ).test(nextBody);
          if (!alreadyHasFocal) {
            nextBody = rewriteFocalInMarkdown(nextBody, url, f.focal_x, f.focal_y);
            touched = true;
          }
        }
        if (touched) onBodyUpdate(nextBody);
      })
      .catch(() => setRows(urls.map((url) => ({ url, photoId: null, focalX: null, focalY: null }))))
      .finally(() => setLoading(false));
    // Intentionally not depending on bodyMarkdown/onBodyUpdate here — we
    // want the auto-apply to run ONCE per modal open, not every time the
    // markdown mutates (which it does when we auto-apply).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, urls]);

  async function saveFocal(row: PhotoRow, x: number, y: number) {
    if (row.photoId == null) return;
    // Optimistically update local state.
    setRows((prev) => prev.map((r) => (r.url === row.url ? { ...r, focalX: x, focalY: y } : r)));
    // Rewrite the markdown so this newsletter renders with the new focal.
    onBodyUpdate(rewriteFocalInMarkdown(bodyMarkdown, row.url, x, y));
    // Persist to event_photos so future newsletters get the same crop.
    try {
      await fetch("/api/newsletter-ai/photo-focal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photo_id: row.photoId, focal_x: x, focal_y: y }),
      });
      setSavedFlash(row.url);
      setTimeout(() => setSavedFlash(null), 1500);
    } catch { /* markdown is already updated — DB write is nice-to-have */ }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-[color:var(--rule)] flex items-center justify-between">
          <div>
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">Adjust photographs</div>
            <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
              Click any photo to re-center its crop. Changes save immediately and remember for future newsletters.
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-navy text-2xl leading-none px-2">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && <div className="text-sm text-[color:var(--muted)]">Loading…</div>}
          {!loading && rows.length === 0 && (
            <div className="text-sm text-[color:var(--muted)]">No images in this draft yet.</div>
          )}
          {rows.map((row) => (
            <PhotoRowView
              key={row.url}
              row={row}
              flash={savedFlash === row.url}
              onAdjust={() => row.photoId != null && setEditing(row)}
            />
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[color:var(--rule)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-navy text-white px-4 py-2 rounded text-[12px] font-semibold tracking-wide"
          >
            Done
          </button>
        </div>
      </div>

      {editing && editing.photoId != null && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-[color:var(--rule)] flex items-center justify-between">
              <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">Re-center photo</div>
              <button type="button" onClick={() => setEditing(null)} className="text-navy text-2xl leading-none px-2">&times;</button>
            </div>
            <div className="flex-1 relative">
              <FocalPicker
                src={editing.url}
                initialX={editing.focalX ?? 50}
                initialY={editing.focalY ?? 50}
                onSave={async (x, y) => {
                  await saveFocal(editing, x, y);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoRowView({ row, flash, onAdjust }: { row: PhotoRow; flash: boolean; onAdjust: () => void }) {
  const objectPos = row.focalX != null && row.focalY != null ? `${row.focalX}% ${row.focalY}%` : "50% 50%";
  return (
    <div
      className={`flex items-center gap-4 p-3 border rounded ${flash ? "border-emerald-400 bg-emerald-50" : "border-[color:var(--rule)]"}`}
    >
      <div className="w-20 h-20 shrink-0 bg-gray-200 rounded overflow-hidden relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={row.url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: objectPos }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[color:var(--navy-ink)] truncate">{row.url.split("/").pop() ?? row.url}</div>
        <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
          {row.photoId == null
            ? "Not a gallery photo — can't adjust"
            : row.focalX != null && row.focalY != null
              ? `Focal ${Math.round(row.focalX)}%, ${Math.round(row.focalY)}%${flash ? " — saved" : ""}`
              : "Default centering (50 / 50)"}
        </div>
      </div>
      {row.photoId != null && (
        <button
          type="button"
          onClick={onAdjust}
          className="bg-white border border-navy text-navy px-3 py-1.5 rounded text-[12px] font-semibold shrink-0"
        >
          Adjust
        </button>
      )}
    </div>
  );
}

/** Interactive focal-point picker — a draggable dot on the image
 *  showing where the "keep visible when cropped" spot is. Simpler
 *  and email-relevant than a full crop rectangle since email cells
 *  are square + object-fit:cover already. */
function FocalPicker({
  src,
  initialX,
  initialY,
  onSave,
  onCancel,
}: {
  src: string;
  initialX: number;
  initialY: number;
  onSave: (x: number, y: number) => void;
  onCancel: () => void;
}) {
  const [x, setX] = useState(initialX);
  const [y, setY] = useState(initialY);
  const [dragging, setDragging] = useState(false);

  function onMove(ev: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) {
    if (!dragging) return;
    const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
    const clientX = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
    const clientY = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
    const px = ((clientX - rect.left) / rect.width) * 100;
    const py = ((clientY - rect.top) / rect.height) * 100;
    setX(Math.max(0, Math.min(100, px)));
    setY(Math.max(0, Math.min(100, py)));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 flex items-center justify-center bg-gray-100 overflow-hidden">
        <div
          className="relative max-w-full max-h-full"
          style={{ cursor: dragging ? "grabbing" : "crosshair" }}
          onMouseDown={(e) => {
            setDragging(true);
            onMove(e);
          }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
          onMouseMove={onMove}
          onTouchStart={(e) => {
            setDragging(true);
            onMove(e);
          }}
          onTouchEnd={() => setDragging(false)}
          onTouchMove={onMove}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ maxWidth: "100%", maxHeight: "60vh", display: "block", pointerEvents: "none" }}
          />
          {/* Focal-point marker */}
          <div
            style={{
              position: "absolute",
              left: `calc(${x}% - 14px)`,
              top: `calc(${y}% - 14px)`,
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "3px solid white",
              boxShadow: "0 0 0 2px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
              pointerEvents: "none",
              background: "rgba(255,255,255,0.15)",
            }}
          />
        </div>
      </div>
      <div className="px-5 py-3 border-t border-[color:var(--rule)] flex items-center justify-between gap-3">
        <div className="text-[12px] text-[color:var(--muted)]">
          Click or drag on the photo to place the focal point. This is the spot that stays visible when the photo is cropped square in the newsletter.
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="border border-[color:var(--rule)] text-navy px-3 py-1.5 rounded text-[12px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(x, y)}
            className="bg-navy text-white px-4 py-1.5 rounded text-[12px] font-semibold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
