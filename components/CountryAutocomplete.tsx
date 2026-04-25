"use client";

import { useEffect, useRef, useState } from "react";
import {
  COUNTRIES,
  findCountry,
  searchCountries,
  type Country,
} from "@/lib/countries";

type Props = {
  /** Form field name — the picked country's canonical name is submitted under this. */
  name: string;
  label: string;
  required?: boolean;
  full?: boolean;
  placeholder?: string;
  defaultValue?: string | null;
  /** Optional helper text shown beneath the field. */
  hint?: string;
};

/**
 * Single-select country picker. Type-to-search dropdown of ~190 countries +
 * common aliases (UK, US, Burma, Korea, etc.). Submits the canonical country
 * name as a hidden input so the form action receives a real ISO short name
 * instead of free text.
 *
 * Selecting a country locks the input to a chip with a clear button — user
 * can't accidentally end up with two values typed.
 */
export function CountryAutocomplete({
  name, label, required, full, placeholder, defaultValue, hint,
}: Props) {
  const [picked, setPicked] = useState<Country | null>(() =>
    defaultValue ? findCountry(defaultValue) : null
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const results = open && query ? searchCountries(query, 8) : [];

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const choose = (c: Country) => {
    setPicked(c);
    setQuery("");
    setOpen(false);
  };

  const clear = () => {
    setPicked(null);
    setQuery("");
    setOpen(true);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = results[highlight];
      if (c) choose(c);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
        {required ? " *" : ""}
      </span>

      {/* Hidden input carries the canonical country name into FormData. */}
      <input type="hidden" name={name} value={picked?.name ?? ""} />

      <div ref={wrapRef} className="relative">
        {picked ? (
          <div className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0 truncate">
              <span aria-hidden className="text-base leading-none shrink-0">
                {picked.flag}
              </span>
              <span className="truncate text-[color:var(--navy-ink)]">{picked.name}</span>
            </span>
            <button
              type="button"
              onClick={clear}
              aria-label="Clear country"
              className="text-[color:var(--muted)] hover:text-navy text-lg leading-none shrink-0"
            >
              ×
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setHighlight(0);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKey}
              placeholder={placeholder ?? "Start typing…"}
              autoComplete="off"
              required={required}
              aria-required={required}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            />
            {open && results.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 mt-1 bg-white border border-[color:var(--rule)] rounded shadow-md z-20 max-h-[260px] overflow-y-auto"
              >
                {results.map((c, i) => (
                  <li key={c.name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => choose(c)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                        i === highlight ? "bg-ivory-2" : "bg-white"
                      } hover:bg-ivory-2`}
                    >
                      <span aria-hidden>{c.flag}</span>
                      <span>{c.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {open && query && results.length === 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-[color:var(--rule)] rounded p-3 text-xs text-[color:var(--muted)] z-20">
                No country matches “{query}”.
              </div>
            )}
          </>
        )}
      </div>

      {hint && (
        <span className="block mt-1 text-xs text-[color:var(--muted)]">{hint}</span>
      )}
    </label>
  );
}

/** Re-export for convenience in case callers want the canonical list. */
export { COUNTRIES };
