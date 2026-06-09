"use client";

import { useId, useState } from "react";

/** Password input with a show/hide toggle button on the right.
 * Same prop shape as a regular controlled <input>, plus an optional
 * `errored` flag that swaps the border red. */
interface Props {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  errored?: boolean;
  /** Optional aria-label override. The eye-button gets its own
   * aria-label automatically. */
  ariaLabel?: string;
}

export default function PasswordInput({
  value,
  onChange,
  autoFocus,
  autoComplete = "current-password",
  required,
  minLength,
  placeholder,
  errored,
  ariaLabel,
}: Props) {
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`w-full border rounded px-3 py-2.5 pr-[68px] text-sm bg-white ${
          errored ? "border-red-500" : "border-[color:var(--rule)]"
        }`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] hover:text-navy px-2 py-1"
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}
