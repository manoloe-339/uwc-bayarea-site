"use client";

import { useEffect, useState } from "react";

// Client-side helpers for the alumni selection form:
// - Counts checkboxes named `ids` inside the form
// - Header "select all" toggle wires up on mount
// - "Send to selected" button shows N and disables when 0
// Works even without hydration via native form submit; the client part
// only improves the UX (count + disabled state + select-all).
//
// Why the `visibleOnly` filter exists: the page renders both a desktop
// table view AND a mobile cards view, each containing the full set of
// row checkboxes. CSS (`hidden md:block` / `md:hidden`) hides one
// breakpoint's view, but the inputs stay in the DOM — so a naive
// querySelectorAll('input[name=ids]') sees every row TWICE and the
// selected-count doubles. offsetParent === null is the standard "this
// element (or an ancestor) is display:none" check.

function visibleIdInputs(form: HTMLFormElement): HTMLInputElement[] {
  return Array.from(
    form.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="ids"]',
    ),
  ).filter((el) => el.offsetParent !== null);
}

export function SelectAllCheckbox({ formId }: { formId: string }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const inputs = visibleIdInputs(form);
    setChecked(inputs.length > 0 && inputs.every((i) => i.checked));
  }, [formId]);

  function toggle(e: React.ChangeEvent<HTMLInputElement>) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const next = e.target.checked;
    const inputs = visibleIdInputs(form);
    inputs.forEach((i) => (i.checked = next));
    // Also reset the hidden mirror-set so the GET submit doesn't send
    // every id twice once the user toggles select-all.
    Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][name="ids"]',
      ),
    )
      .filter((el) => el.offsetParent === null)
      .forEach((i) => (i.checked = false));
    setChecked(next);
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
      const n = visibleIdInputs(form).filter((i) => i.checked).length;
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
