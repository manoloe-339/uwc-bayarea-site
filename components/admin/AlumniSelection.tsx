"use client";

import { useEffect, useState } from "react";

// Client-side helpers for the alumni selection form:
// - Counts checkboxes named `ids` inside the form
// - Header "select all" toggle wires up on mount
// - "Send to selected" button shows N and disables when 0
// Works even without hydration via native form submit; the client part
// only improves the UX (count + disabled state + select-all).

export function SelectAllCheckbox({ formId }: { formId: string }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const inputs = () =>
      Array.from(form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]'));
    setChecked(inputs().every((i) => i.checked) && inputs().length > 0);
  }, [formId]);

  function toggle(e: React.ChangeEvent<HTMLInputElement>) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const inputs = form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]');
    inputs.forEach((i) => (i.checked = e.target.checked));
    setChecked(e.target.checked);
    // Dispatch change so SubmitButton updates its count.
    inputs.forEach((i) => i.dispatchEvent(new Event("change", { bubbles: true })));
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={toggle}
      aria-label="Select all"
      className="align-middle"
    />
  );
}

export function SelectedCountLink({
  formId,
  label = "Send to selected",
  formAction,
}: {
  formId: string;
  label?: string;
  formAction?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const recount = () => {
      const n = form.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][name="ids"]:checked'
      ).length;
      setCount(n);
    };
    recount();
    form.addEventListener("change", recount);
    return () => form.removeEventListener("change", recount);
  }, [formId]);

  const disabled = count === 0;
  return (
    <button
      type="submit"
      form={formId}
      formAction={formAction}
      disabled={disabled}
      className={`text-sm ${disabled ? "text-[color:var(--muted)] cursor-not-allowed" : "text-navy hover:underline font-semibold"}`}
    >
      {label}
      {count > 0 ? ` (${count}) →` : ""}
    </button>
  );
}
