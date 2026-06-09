"use client";

import { useState } from "react";
import { companyLogoCandidates } from "@/lib/company-logo";

interface Props {
  /** LinkedIn-served logo URL captured at enrichment time. Preferred
   * source when present — but LinkedIn signs these with an expiry
   * timestamp, so 404s are expected; we fall through to Logo.dev. */
  storedLogoUrl?: string | null;
  website: string | null;
  /** LinkedIn company/school URL — used as a secondary domain source
   * when `website` is missing. */
  linkedinUrl?: string | null;
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

export function CompanyLogo({
  storedLogoUrl = null,
  website,
  linkedinUrl = null,
  companyName,
  size = 24,
}: Props) {
  // Priority-ordered candidate URLs. The component walks the list on
  // each <img> onError, rendering an initials block when exhausted.
  const candidates: string[] = [];
  if (storedLogoUrl) candidates.push(storedLogoUrl);
  for (const u of companyLogoCandidates(
    website,
    linkedinUrl,
    Math.max(size * 2, 48),
  )) {
    candidates.push(u);
  }

  const [idx, setIdx] = useState(0);
  const current = candidates[idx];

  if (!current) {
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
      src={current}
      alt=""
      width={size}
      height={size}
      onError={() => setIdx((i) => i + 1)}
      loading="lazy"
      className="shrink-0 rounded bg-white object-contain"
      style={{ width: size, height: size }}
    />
  );
}
