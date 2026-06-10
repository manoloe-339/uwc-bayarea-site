"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CropEditor from "@/components/admin/CropEditor";
import { deleteLoginAsset, replaceLoginAssetImage } from "./actions";

interface Props {
  id: number;
  label: string;
  imageUrl: string;
  kind: "university_logo" | "company_logo" | "flag";
}

export default function LoginAssetCard({ id, label, imageUrl, kind }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSave = async (blob: Blob) => {
    setBusy(true);
    const fd = new FormData();
    fd.append("id", String(id));
    fd.append(
      "file",
      new File([blob], `${kind}-crop.jpg`, { type: "image/jpeg" }),
    );
    await replaceLoginAssetImage(fd);
    setEditing(false);
    setBusy(false);
    router.refresh();
  };

  return (
    <li className="bg-white border border-[color:var(--rule)] rounded-md p-3">
      <div className="aspect-square bg-[color:var(--ivory-2)] rounded mb-2 overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={label}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="text-xs font-bold text-[color:var(--navy-ink)] truncate">
        {label}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy}
          className="text-[11px] text-navy hover:underline disabled:opacity-50"
        >
          Crop / zoom
        </button>
        <form action={deleteLoginAsset}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="text-[11px] text-red-700 hover:underline"
          >
            Delete
          </button>
        </form>
      </div>
      {editing && (
        <CropEditor
          src={imageUrl}
          aspect={1}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      )}
    </li>
  );
}
