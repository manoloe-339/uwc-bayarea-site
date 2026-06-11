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
    <span className="fp-nl">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Natural language"
        onClick={() => handleChange(!on)}
        className="fp-nl__switch"
      />
      <span className="fp-nl__label">Natural language</span>
    </span>
  );
}
