"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

/** Photo referenced in the draft, with lookup status from event_photos. */
type PhotoRow = {
  url: string;
  photoId: number | null;
  eventName: string | null;
  cropX: number | null;
  cropY: number | null;
  cropW: number | null;
  cropH: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  bodyMarkdown: string;
  onBodyUpdate: (nextBody: string) => void;
};

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

/** Rewrite every markdown line that references `url` to include the
 *  crop rectangle. Preserves the existing =W% sizing.
 *
 *   ![alt](url =48%)                     → ![alt](url =48% crop=X,Y,W,H)
 *   ![alt](url =48% crop=A,B,C,D)        → ![alt](url =48% crop=X,Y,W,H)
 *   ![alt](url =48% focal=A,B)           → ![alt](url =48% crop=X,Y,W,H)   (focal syntax retired)
 */
function rewriteCropInMarkdown(
  md: string,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const urlEsc = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(!\\[[^\\]]*\\]\\(${urlEsc})(\\s+=\\d+%?(?:x\\d+)?)?` +
      `(?:\\s+(?:crop|focal)=[\\d.,]+)?\\)`,
    "g",
  );
  const cropAttr = `crop=${x.toFixed(1)},${y.toFixed(1)},${w.toFixed(1)},${h.toFixed(1)}`;
  return md.replace(re, (_full, prefix, size) => `${prefix}${size ?? ""} ${cropAttr})`);
}

export default function AdjustPhotosModal({ open, onClose, bodyMarkdown, onBodyUpdate }: Props) {
  const urls = useMemo(() => extractImageUrls(bodyMarkdown), [bodyMarkdown]);
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PhotoRow | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!open || urls.length === 0) {
      setRows([]);
      return;
    }
    setLoading(true);
    const qs = urls.map((u) => `url=${encodeURIComponent(u)}`).join("&");
    fetch(`/api/newsletter-ai/photo-focal?${qs}`)
      .then((r) => r.json())
      .then((data: { crops: Array<{ blob_url: string; photo_id: number; event_name?: string; crop_x: number | null; crop_y: number | null; crop_w: number | null; crop_h: number | null }> }) => {
        const byUrl = new Map(data.crops.map((f) => [f.blob_url, f]));
        setRows(
          urls.map((url) => {
            const f = byUrl.get(url);
            return {
              url,
              photoId: f?.photo_id ?? null,
              eventName: f?.event_name ?? null,
              cropX: f?.crop_x ?? null,
              cropY: f?.crop_y ?? null,
              cropW: f?.crop_w ?? null,
              cropH: f?.crop_h ?? null,
            };
          }),
        );
        // Auto-apply saved crops. Also OVERWRITES existing crop
        // markdown that looks invalid (values > 100 = legacy pixel
        // units from an earlier bug), so bad markdown gets healed
        // from the correct DB value on next open.
        let nextBody = bodyMarkdown;
        let touched = false;
        const urlEsc = (u: string) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        for (const [url, f] of byUrl.entries()) {
          if (f.crop_x == null || f.crop_y == null || f.crop_w == null || f.crop_h == null) continue;
          const existingRe = new RegExp(`\\(${urlEsc(url)}[^)]*crop=([\\d.]+),([\\d.]+),([\\d.]+),([\\d.]+)`);
          const mExisting = nextBody.match(existingRe);
          const looksValid =
            mExisting != null &&
            Number(mExisting[3]) <= 100 &&
            Number(mExisting[4]) <= 100;
          if (!mExisting || !looksValid) {
            nextBody = rewriteCropInMarkdown(nextBody, url, f.crop_x, f.crop_y, f.crop_w, f.crop_h);
            touched = true;
          }
        }
        if (touched) onBodyUpdate(nextBody);
      })
      .catch(() =>
        setRows(urls.map((url) => ({ url, photoId: null, eventName: null, cropX: null, cropY: null, cropW: null, cropH: null }))),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, urls]);

  async function saveCrop(row: PhotoRow, x: number, y: number, w: number, h: number) {
    if (row.photoId == null) return;
    setRows((prev) =>
      prev.map((r) => (r.url === row.url ? { ...r, cropX: x, cropY: y, cropW: w, cropH: h } : r)),
    );
    onBodyUpdate(rewriteCropInMarkdown(bodyMarkdown, row.url, x, y, w, h));
    try {
      await fetch("/api/newsletter-ai/photo-focal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          photo_id: row.photoId,
          crop_x: x,
          crop_y: y,
          crop_w: w,
          crop_h: h,
        }),
      });
      setSavedFlash(row.url);
      setTimeout(() => setSavedFlash(null), 1500);
    } catch { /* markdown already updated */ }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-[color:var(--rule)] flex items-center justify-between">
          <div>
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">Adjust photographs</div>
            <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
              Drag to reposition + slide to zoom on each photo. Saves immediately, remembers for future newsletters.
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
        <CropModal
          src={editing.url}
          initial={{
            x: editing.cropX,
            y: editing.cropY,
            w: editing.cropW,
            h: editing.cropH,
          }}
          onSave={async (x, y, w, h) => {
            await saveCrop(editing, x, y, w, h);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PhotoRowView({
  row, flash, onAdjust,
}: {
  row: PhotoRow;
  flash: boolean;
  onAdjust: () => void;
}) {
  // Preview uses the same CSS the newsletter uses so the thumbnail
  // reflects what recipients will see.
  const hasCrop = row.cropX != null && row.cropW != null;
  return (
    <div
      className={`flex items-center gap-4 p-3 border rounded ${flash ? "border-emerald-400 bg-emerald-50" : "border-[color:var(--rule)]"}`}
    >
      <div className="w-20 h-20 shrink-0 rounded overflow-hidden relative bg-gray-200">
        {hasCrop ? (
          <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.url}
              alt=""
              style={{
                position: "absolute",
                width: `${100 / (row.cropW ?? 1) * 100}%`,
                height: `${100 / (row.cropH ?? 1) * 100}%`,
                left: `${-(row.cropX ?? 0) * 100 / (row.cropW ?? 1)}%`,
                top: `${-(row.cropY ?? 0) * 100 / (row.cropH ?? 1)}%`,
                maxWidth: "none",
                display: "block",
              }}
            />
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={row.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[color:var(--navy-ink)] truncate">
          {row.eventName ?? "Unlinked photo"}
        </div>
        <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
          {row.photoId == null
            ? "Not a gallery photo — can't adjust"
            : hasCrop
              ? `Custom crop${flash ? " — saved" : ""}`
              : "Default centered crop"}
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

/** Crop modal built on react-easy-crop. Locked to 1:1 aspect (matches
 *  the newsletter's square cell). Returns the crop rectangle as
 *  percentages of the source image. */
function CropModal({
  src,
  initial,
  onSave,
  onCancel,
}: {
  src: string;
  initial: { x: number | null; y: number | null; w: number | null; h: number | null };
  onSave: (x: number, y: number, w: number, h: number) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPct, setAreaPct] = useState<Area | null>(null);

  // react-easy-crop signature is (croppedArea, croppedAreaPixels).
  // Percentage-based area is FIRST — earlier code got these swapped
  // and saved pixel values (e.g. 3024) as if they were percentages,
  // producing broken crops.
  const onCropComplete = useCallback((pct: Area, _pixels: Area) => {
    setAreaPct(pct);
  }, []);

  // If we have an initial crop, seed the cropper's zoom to roughly
  // match it. react-easy-crop's crop.x/y are in source pixel space,
  // so we can't perfectly restore state — but a matching zoom is close
  // enough that the admin's second-visit adjustment starts near the
  // saved crop rather than default.
  useEffect(() => {
    if (initial.w && initial.w < 100) {
      // Higher zoom = tighter crop. zoom = 100 / crop.width%.
      setZoom(Math.max(1, Math.min(3, 100 / initial.w)));
    }
  }, [initial.w]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-[color:var(--rule)] flex items-center justify-between">
          <div>
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">Re-center + zoom photo</div>
            <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
              Drag to move · use the slider or scroll to zoom. The square inside is what appears in the newsletter cell.
            </div>
          </div>
          <button type="button" onClick={onCancel} className="text-navy text-2xl leading-none px-2">&times;</button>
        </div>

        <div className="flex-1 relative bg-gray-100">
          <Cropper
            image={src}
            aspect={1}
            crop={crop}
            zoom={zoom}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
            zoomWithScroll
            restrictPosition
            showGrid
          />
        </div>

        <div className="px-5 py-3 border-t border-[color:var(--rule)] flex items-center gap-4">
          <label className="flex items-center gap-2 flex-1">
            <span className="text-[11px] tracking-[.18em] uppercase font-bold text-navy">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </label>
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
              disabled={!areaPct}
              onClick={() => areaPct && onSave(areaPct.x, areaPct.y, areaPct.width, areaPct.height)}
              className="bg-navy text-white px-4 py-1.5 rounded text-[12px] font-semibold disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
