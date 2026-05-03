"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  galleryHref: string;
  signupHref?: string;
}

/** Soft veil + centered card laid over the May 1 flyer telling visitors
 * the event already happened, with two CTAs (gallery + signup). The
 * dismiss × removes the overlay so the flyer can be inspected. */
export function MissedEventOverlay({
  galleryHref,
  signupHref = "/signup",
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center px-4 bg-[color:var(--ivory)]/80 backdrop-blur-[2px]">
      <div className="relative bg-white rounded-[14px] shadow-2xl max-w-[440px] w-full p-7 sm:p-8 text-center">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute top-3 right-4 text-[color:var(--muted)] hover:text-navy text-2xl leading-none w-8 h-8"
        >
          ×
        </button>
        <h2 className="font-serif font-semibold text-[color:var(--navy-ink)] text-[28px] leading-[1.1] tracking-[-0.005em] m-0">
          Sorry you missed this.
        </h2>
        <div className="mt-6 space-y-3">
          <Link
            href={galleryHref}
            className="block w-full bg-navy text-white text-center px-6 py-3.5 rounded-full text-[12px] font-bold tracking-[.22em] uppercase hover:opacity-90"
          >
            See the gallery of photos
          </Link>
          <Link
            href={signupHref}
            className="block w-full bg-white border border-[color:var(--rule)] text-navy text-center px-6 py-3.5 rounded-full text-[12px] font-bold tracking-[.22em] uppercase hover:border-navy"
          >
            Sign up for updates
          </Link>
        </div>
      </div>
    </div>
  );
}
