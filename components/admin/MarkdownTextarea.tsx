"use client";

import { useRef, useState } from "react";

interface Props {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  hint?: string;
}

/** Lightweight markdown textarea with an "Add link" toolbar button.
 * Storage is a tiny markdown subset (paragraphs, **bold**, *italic*,
 * [text](url)). The "Add link" button wraps the current text selection
 * in [selection](url) syntax. */
export function MarkdownTextarea({
  name, label, defaultValue, rows = 5, placeholder, hint,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState<string>(defaultValue ?? "");

  const wrapSelectionWithLink = () => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const text = selected || "link text";
    const url = window.prompt("Enter URL (e.g. https://…):", "https://");
    if (!url) return;
    const md = `[${text}](${url})`;
    const next = value.slice(0, start) + md + value.slice(end);
    setValue(next);
    // Restore selection inside the new link text portion.
    requestAnimationFrame(() => {
      const insertedTextStart = start + 1;
      const insertedTextEnd = insertedTextStart + text.length;
      ta.focus();
      ta.setSelectionRange(insertedTextStart, insertedTextEnd);
    });
  };

  const wrapSelection = (prefix: string, suffix: string, fallback: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const md = `${prefix}${selected}${suffix}`;
    const next = value.slice(0, start) + md + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      const innerStart = start + prefix.length;
      const innerEnd = innerStart + selected.length;
      ta.focus();
      ta.setSelectionRange(innerStart, innerEnd);
    });
  };

  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        <ToolbarButton onClick={wrapSelectionWithLink}>🔗 Link</ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("**", "**", "bold text")}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("*", "*", "italic text")}>
          <em>I</em>
        </ToolbarButton>
      </div>
      <textarea
        ref={ref}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-mono"
      />
      <span className="block mt-1 text-xs text-[color:var(--muted)]">
        {hint ??
          "Markdown: blank line for new paragraph, **bold**, *italic*, [text](https://link)."}
      </span>
    </label>
  );
}

function ToolbarButton({
  onClick, children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 border border-[color:var(--rule)] rounded text-xs bg-white hover:border-navy hover:text-navy"
    >
      {children}
    </button>
  );
}
