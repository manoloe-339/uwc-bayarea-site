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
    // Deliberately DO NOT set `applied=1` — so toggling just flips mode
    // and the NL search doesn't run until the user hits Apply filters.
    const qInput = document.querySelector<HTMLInputElement>('input[name="q"]');
    const q = qInput?.value.trim() ?? "";
    const params = new URLSearchParams();
    if (next) params.set("searchNL", "1");
    if (q) params.set("q", q);
    const qs = params.toString();
    window.location.href = "/admin/alumni" + (qs ? "?" + qs : "");
  };
  return (
    <label className="inline-flex items-center gap-2 text-[11px] tracking-[.14em] uppercase font-semibold text-navy cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Natural language"
        onClick={() => handleChange(!on)}
        className={`relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full border transition-colors ${
          on
            ? "bg-navy border-navy"
            : "bg-white border-[color:var(--rule)]"
        }`}
      >
        <span
          className={`inline-block h-[12px] w-[12px] rounded-full shadow-sm transition-transform ${
            on ? "translate-x-[16px] bg-white" : "translate-x-[3px] bg-[color:var(--muted)]"
          }`}
        />
      </button>
      <span>Natural language</span>
    </label>
  );
}
