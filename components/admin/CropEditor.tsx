"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

interface Props {
  /** Source image URL (must be CORS-readable — Vercel Blob is). */
  src: string;
  /** Crop region's aspect ratio. 1 = square (default). */
  aspect?: number;
  /** Fires when the user clicks Save with the cropped JPEG blob. */
  onSave: (blob: Blob) => Promise<void> | void;
  onCancel: () => void;
}

/** Rasterize an SVG (or any image) to a fixed-size square PNG data
 * URL, with white background and aspect preserved (letterboxed).
 * react-easy-crop relies on the source's intrinsic naturalWidth /
 * naturalHeight, but SVGs that only declare a viewBox (like the
 * lipis/flag-icons set) return ambiguous natural dimensions when
 * loaded via <img>, throwing the crop coordinate system off. By
 * rasterizing first we hand the cropper a well-formed bitmap with
 * naturalWidth = naturalHeight = SIZE. */
async function rasterize(src: string, size = 1024): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Failed to load source"));
    el.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  // Preserve aspect by fitting "contain" inside the square — extra
  // space is white (matches the saved crop's background). naturalW/H
  // for SVGs without explicit dims defaults to 300x150 across most
  // browsers, which is fine: we just letterbox to 4:3-ish here.
  const w = img.naturalWidth || 300;
  const h = img.naturalHeight || 150;
  const aspect = w / h;
  let drawW: number, drawH: number, drawX: number, drawY: number;
  if (aspect >= 1) {
    drawW = size;
    drawH = size / aspect;
    drawX = 0;
    drawY = (size - drawH) / 2;
  } else {
    drawH = size;
    drawW = size * aspect;
    drawY = 0;
    drawX = (size - drawW) / 2;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  return canvas.toDataURL("image/png");
}

/** Modal-style cropping UI built on react-easy-crop. The user drags
 * the crop region around with the mouse, zooms with the slider, and
 * Save spins the chosen region into a JPEG Blob using a canvas. */
export default function CropEditor({
  src,
  aspect = 1,
  onSave,
  onCancel,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For SVG sources, rasterize to a known-size PNG before handing to
  // the cropper. Non-SVG sources pass through unchanged.
  const [rasterSrc, setRasterSrc] = useState<string | null>(
    src.endsWith(".svg") ? null : src,
  );
  useEffect(() => {
    if (!src.endsWith(".svg")) {
      setRasterSrc(src);
      return;
    }
    let cancelled = false;
    rasterize(src)
      .then((url) => {
        if (!cancelled) setRasterSrc(url);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load image for cropping.");
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!pixels || !rasterSrc) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await cropToBlob(rasterSrc, pixels);
      await onSave(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save crop.");
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(11,37,69,.65)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="bg-white rounded-[12px] max-w-[640px] w-full p-5 shadow-2xl">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
          Crop image
        </div>
        <div
          className="relative rounded-md overflow-hidden"
          style={{ height: 380, background: "#fff" }}
        >
          {rasterSrc ? (
          <Cropper
            image={rasterSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            // minZoom < 1 lets you zoom OUT past the image's natural
            // size, giving the asset more letterboxing inside the
            // square crop. Used when the source already has the
            // content tightly framed and you want some padding.
            minZoom={0.5}
            maxZoom={4}
            // restrictPosition=false is required to let the image
            // sit anywhere (including showing background) when
            // zoomed out below 1.
            restrictPosition={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            // White preview background so the user sees exactly what
            // the saved JPEG will look like — including any
            // letterboxing introduced by zooming below 1×.
            style={{
              containerStyle: { background: "#fff" },
              mediaStyle: {},
              cropAreaStyle: {},
            }}
          />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[color:var(--muted)]">
              Loading image…
            </div>
          )}
        </div>
        <label className="block mt-4">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
            Zoom — drag below 1× to shrink the image inside the square
          </span>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={busy}
            className="w-full"
          />
        </label>
        {error && (
          <div role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded text-sm font-bold text-[color:var(--navy-ink)] hover:bg-[color:var(--ivory-2)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || !pixels}
            className="bg-navy text-white px-4 py-2 rounded text-sm font-bold hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save crop"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Loads the image cross-origin, draws the selected pixel rectangle
 * to a canvas, and resolves a JPEG Blob. Width/height are taken from
 * the crop result so the output is the actual crop pixel dimensions
 * (no upscaling, no extra downscaling). */
async function cropToBlob(src: string, pixels: Area): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  // Fill with white first — pixels outside the image bounds (which
  // happens when the user zooms below 1×) would otherwise become
  // black in the JPEG output. White matches the login backdrop's
  // logo-tile background.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    img,
    pixels.x,
    pixels.y,
    pixels.width,
    pixels.height,
    0,
    0,
    pixels.width,
    pixels.height,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Couldn't encode JPEG"));
        else resolve(blob);
      },
      "image/jpeg",
      0.9,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
