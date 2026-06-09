"use client";

import { useState } from "react";
import { companyLogoUrl } from "@/lib/company-logo";

interface Props {
  /** LinkedIn-served logo URL captured at enrichment time. Preferred
   * source when present — but LinkedIn signs these with an expiry
   * timestamp, so 404s are expected; we fall through to Logo.dev. */
  storedLogoUrl?: string | null;
  website: string | null;
  /** LinkedIn company URL — used as a secondary domain source when
   * `website` is missing (slug.com heuristic). */
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
  // Build the candidate list in priority order. The component walks
  // through it on each <img> onError, finally rendering an initials
  // block when all candidates are exhausted.
  const candidates: string[] = [];
  if (storedLogoUrl) candidates.push(storedLogoUrl);
  const logoDevUrl = companyLogoUrl(website, linkedinUrl, Math.max(size * 2, 48));
  if (logoDevUrl) candidates.push(logoDevUrl);

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
