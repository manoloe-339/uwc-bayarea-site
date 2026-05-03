/** Inline LinkedIn brand mark — used as a small affordance next to
 * alumni names where we link out to their LinkedIn profile. */
export function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-2.26-1.94-2.26A2.06 2.06 0 0012 14.31V19h-3v-9h2.86v1.18a3.27 3.27 0 012.95-1.39C18.21 9.79 19 11.32 19 14.04z" />
    </svg>
  );
}
