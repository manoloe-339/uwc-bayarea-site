"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CropEditor from "@/components/admin/CropEditor";
import { uploadUwcAsset, clearUwcAsset, type UwcSlot } from "./actions";

interface Props {
  canonical: string;
  slot: UwcSlot;
  label: string;
  help: string;
  url: string | null;
}

/**
 * Single asset slot: preview, file/url upload form, Crop button (when
 * filled), Remove button. The Crop button opens the CropEditor modal
 * on the existing image; saving sends the cropped JPEG back through
 * the same uploadUwcAsset server action that handles file uploads.
 */
export default function UwcSlotCard({
  canonical,
  slot,
  label,
  help,
  url,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSave = async (blob: Blob) => {
    setBusy(true);
    const fd = new FormData();
    fd.append("canonical", canonical);
    fd.append("slot", slot);
    fd.append("file", new File([blob], `${slot}-crop.jpg`, { type: "image/jpeg" }));
    await uploadUwcAsset(fd);
    setEditing(false);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="border border-[color:var(--rule)] rounded-md p-3 flex flex-col">
      <div className="text-[11px] tracking-[.16em] uppercase font-bold text-[color:var(--muted)] mb-2">
        {label}
      </div>
      <div className="aspect-square bg-[color:var(--ivory-2)] rounded flex items-center justify-center mb-2 overflow-hidden">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${canonical} ${label}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-xs text-[color:var(--muted)]">— empty —</span>
        )}
      </div>
      <p className="text-[11px] text-[color:var(--muted)] mb-2 leading-snug">
        {help}
      </p>
      <form action={uploadUwcAsset} className="flex flex-col gap-2">
        <input type="hidden" name="canonical" value={canonical} />
        <input type="hidden" name="slot" value={slot} />
        <input type="file" name="file" accept="image/*" className="text-xs" />
        <input
          type="url"
          name="url"
          placeholder="…or paste an image URL"
          className="text-xs border border-[color:var(--rule)] rounded px-2 py-1 bg-white"
        />
        <button
          type="submit"
          className="bg-navy text-white text-xs font-bold px-3 py-1.5 rounded"
        >
          Upload
        </button>
      </form>
      {url && (
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="text-[11px] text-navy hover:underline disabled:opacity-50"
          >
            Crop / zoom
          </button>
          <form action={clearUwcAsset}>
            <input type="hidden" name="canonical" value={canonical} />
            <input type="hidden" name="slot" value={slot} />
            <button
              type="submit"
              className="text-[11px] text-red-700 hover:underline"
            >
              Remove
            </button>
          </form>
        </div>
      )}
      {editing && url && (
        <CropEditor
          src={url}
          aspect={1}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
