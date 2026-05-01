"use client";

import { useEffect } from "react";

/** Server action redirects don't always reset scroll position — the
 * browser can land on the new page partway down (where the submit
 * button was). Force scroll-to-top on mount so the thank-you headline
 * is visible immediately. */
export function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);
  return null;
}
