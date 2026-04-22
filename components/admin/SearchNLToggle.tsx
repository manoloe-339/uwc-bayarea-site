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
    window.location.href = next ? "/admin/alumni?searchNL=1" : "/admin/alumni";
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
