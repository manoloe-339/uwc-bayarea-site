"use client";

import { useEffect } from "react";

export default function PageviewBeacon({ path }: { path: string }) {
  useEffect(() => {
    const payload = JSON.stringify({ path });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/track/pageview", blob);
      } else {
        fetch("/api/track/pageview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [path]);
  return null;
}
