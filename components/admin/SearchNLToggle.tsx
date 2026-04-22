"use client";

type Props = {
  on: boolean;
};

/**
 * Inline toggle next to the search-bar label: switches between Filters
 * (default) and Natural-language search. Clicking always navigates to a
 * clean URL (clears stale widget state) with the new mode active.
 */
export function SearchNLToggle({ on }: Props) {
  const handleChange = (next: boolean) => {
    // Preserve the typed query across a mode switch (but still clear
    // every other filter — that's the intended "fresh start" semantics).
    const qInput = document.querySelector<HTMLInputElement>('input[name="q"]');
    const q = qInput?.value.trim() ?? "";
    const params = new URLSearchParams();
    if (next) params.set("searchNL", "1");
    if (q) params.set("q", q);
    const qs = params.toString();
    window.location.href = "/admin/alumni" + (qs ? "?" + qs : "");
  };
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] tracking-[.14em] uppercase font-semibold text-navy cursor-pointer">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => handleChange(e.target.checked)}
        className="align-middle"
      />
      <span>Natural language</span>
    </label>
  );
}
