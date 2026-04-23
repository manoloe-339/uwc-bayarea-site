"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Hammers router.refresh() every 10 seconds when tab is visible, every
 * 30s when hidden. Server components re-render and the dashboard stats
 * update in place.
 */
export function LiveDashboardRefresher() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => router.refresh();
    let interval = setInterval(tick, 10_000);
    const onVis = () => {
      clearInterval(interval);
      interval = setInterval(tick, document.hidden ? 30_000 : 10_000);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);
  return null;
}
