"use client";

export function PrintButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => window.print()}
      className="text-sm font-semibold text-white bg-navy px-5 py-2.5 rounded hover:opacity-90 disabled:opacity-50"
    >
      Print sheets
    </button>
  );
}
