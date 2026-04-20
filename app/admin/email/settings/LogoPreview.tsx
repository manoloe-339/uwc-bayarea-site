"use client";

import { useState } from "react";

// Wrapping the logo_url input so we can mirror the value below as a live
// preview without pulling the whole form into a client component.
export default function LogoPreview({ initial }: { initial: string }) {
  const [url, setUrl] = useState(initial);

  // Sync from the input with the matching name — listen for input events on
  // the form because this component is rendered alongside the <input>.
  function bind(el: HTMLInputElement | null) {
    if (!el) return;
    const form = el.closest("form");
    if (!form) return;
    const input = form.querySelector<HTMLInputElement>('input[name="logo_url"]');
    if (!input) return;
    input.addEventListener("input", () => setUrl(input.value));
  }

  const valid = /^https?:\/\//.test(url);

  return (
    <div ref={bind} className="mt-1 flex items-center gap-3 p-3 bg-ivory-2 rounded-[6px] border border-[color:var(--rule)]">
      <div
        className="flex items-center justify-center bg-[color:var(--navy-ink)] rounded"
        style={{ width: "120px", height: "48px" }}
      >
        {valid ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="logo preview" style={{ maxHeight: "36px", maxWidth: "100%", objectFit: "contain" }} />
        ) : (
          <span className="text-[10px] text-white/60 uppercase tracking-[.22em]">Preview</span>
        )}
      </div>
      <div className="text-xs text-[color:var(--muted)]">
        {valid ? "Absolute URL detected." : "Enter an absolute URL (starts with https://) — email clients can't load relative paths."}
      </div>
    </div>
  );
}
