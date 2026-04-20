"use client";

import { useEffect } from "react";

export default function PageviewBeacon({ path }: { path: string }) {
  useEffect(() => {
    const payload = JSON.stringify({
      path,
      // document.referrer is the external URL that sent the visitor here.
      // Empty for direct traffic or same-origin navigations; the server-side
      // parser strips our own host anyway.
      referrer: typeof document !== "undefined" ? document.referrer : "",
    });
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
