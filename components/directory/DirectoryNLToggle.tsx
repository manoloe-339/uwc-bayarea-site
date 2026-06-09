"use client";

type Props = {
  on: boolean;
};

/**
 * Directory-side mirror of the admin's SearchNLToggle. Same visual
 * switch UX; navigates within /directory and uses the directory's
 * `nl=1` URL flag (not the admin's `searchNL=1`).
 */
export function DirectoryNLToggle({ on }: Props) {
  const handleChange = (next: boolean) => {
    const qInput = document.querySelector<HTMLInputElement>('input[name="q"]');
    const q = qInput?.value.trim() ?? "";
    const params = new URLSearchParams();
    if (next) params.set("nl", "1");
    if (q) params.set("q", q);
    const qs = params.toString();
    window.location.href = "/directory" + (qs ? "?" + qs : "");
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
          on ? "bg-navy border-navy" : "bg-white border-[color:var(--rule)]"
        }`}
      >
        <span
          className={`inline-block h-[12px] w-[12px] rounded-full shadow-sm transition-transform ${
            on
              ? "translate-x-[16px] bg-white"
              : "translate-x-[3px] bg-[color:var(--muted)]"
          }`}
        />
      </button>
      <span>Natural language</span>
    </label>
  );
}
