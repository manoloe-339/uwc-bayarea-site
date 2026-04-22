"use client";

import { useRef, useState, useTransition } from "react";

type Props = {
  photoUrl: string | null;
  name: string;
  fallbackInitial: string;
  uploadAction: (formData: FormData) => Promise<void>;
};

export default function PhotoUploadModal({
  photoUrl,
  name,
  fallbackInitial,
  uploadAction,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = () => dialogRef.current?.showModal();
  const close = () => {
    dialogRef.current?.close();
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) close();
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("photo");
    if (file instanceof File && file.size > 8 * 1024 * 1024) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max is 8 MB. Try a smaller export.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await uploadAction(data);
      } catch (err) {
        // redirect() throws a control-flow error that Next handles — only real
        // errors surface here.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={photoUrl ? "View and replace photo" : "Upload photo"}
        title={photoUrl ? "View and replace photo" : "Upload photo"}
        className="block rounded-full focus:outline-none focus:ring-2 focus:ring-navy"
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="w-20 h-20 rounded-full object-cover bg-ivory-2 border border-[color:var(--rule)] cursor-pointer hover:opacity-90"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-ivory-2 border border-[color:var(--rule)] flex items-center justify-center text-[color:var(--muted)] text-xl font-sans font-bold cursor-pointer hover:bg-[color:var(--rule)]">
            {fallbackInitial}
          </div>
        )}
      </button>

      <dialog
        ref={dialogRef}
        onClick={onBackdropClick}
        className="rounded-[10px] p-0 backdrop:bg-black/50 w-[min(480px,92vw)]"
      >
        <div className="bg-white p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="font-sans text-lg font-bold text-[color:var(--navy-ink)]">
              {photoUrl ? "Replace photo" : "Upload photo"}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="text-[color:var(--muted)] hover:text-navy text-xl leading-none -mt-1"
            >
              ×
            </button>
          </div>

          <div className="flex justify-center mb-5">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={name}
                className="w-60 h-60 rounded-[10px] object-cover bg-ivory-2 border border-[color:var(--rule)]"
              />
            ) : (
              <div className="w-60 h-60 rounded-[10px] bg-ivory-2 border border-[color:var(--rule)] flex items-center justify-center text-[color:var(--muted)] text-5xl font-sans font-bold">
                {fallbackInitial}
              </div>
            )}
          </div>

          <form
            onSubmit={onSubmit}
            encType="multipart/form-data"
            className="space-y-3"
          >
            <label className="block">
              <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1.5">
                Pick an image
              </span>
              <input
                ref={fileInputRef}
                type="file"
                name="photo"
                accept="image/*"
                required
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFileName(f ? f.name : null);
                }}
                className="block text-sm w-full file:mr-3 file:py-2 file:px-3 file:rounded file:border file:border-[color:var(--rule)] file:bg-white file:text-xs file:font-semibold file:text-navy file:cursor-pointer hover:file:bg-ivory-2"
              />
              {fileName && (
                <span className="mt-1.5 block text-xs text-[color:var(--muted)] truncate">
                  {fileName}
                </span>
              )}
            </label>
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[color:var(--rule)]">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy"
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !fileName}
                className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
              >
                {pending ? "Uploading…" : photoUrl ? "Replace" : "Upload"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
