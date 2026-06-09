"use client";

import { useState } from "react";
import { companyLogoUrl } from "@/lib/company-logo";

interface Props {
  website: string | null;
  companyName: string | null;
  /** Pixel size of the rendered box (square). Default 24. */
  size?: number;
}

function initialsOf(name: string | null): string {
  if (!name) return "·";
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const ini = parts.map((w) => w[0]).join("").toUpperCase();
  return ini || "·";
}

export function CompanyLogo({ website, companyName, size = 24 }: Props) {
  const [errored, setErrored] = useState(false);
  const url = companyLogoUrl(website, Math.max(size * 2, 48));

  if (!url || errored) {
    return (
      <span
        aria-hidden
        className="inline-flex items-center justify-center shrink-0 rounded bg-[color:var(--ivory-2)] text-[color:var(--muted)] font-bold"
        style={{
          width: size,
          height: size,
          fontSize: Math.max(9, Math.floor(size * 0.42)),
        }}
      >
        {initialsOf(companyName)}
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      onError={() => setErrored(true)}
      loading="lazy"
      className="shrink-0 rounded bg-white object-contain"
      style={{ width: size, height: size }}
    />
  );
}
