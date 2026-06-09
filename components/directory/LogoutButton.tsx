"use client";

import { useState } from "react";

interface Props {
  className?: string;
  label?: React.ReactNode;
}

export default function LogoutButton({ className, label }: Props = {}) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      await fetch("/api/directory/logout", { method: "POST" });
    } catch {
      // ignore — we always redirect to login below; the worst case is
      // a stale cookie and the next page load through middleware
      // kicks them back here anyway.
    }
    window.location.href = "/directory/login";
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={
        className ??
        "text-[12px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] hover:text-navy disabled:opacity-50"
      }
    >
      {busy ? "Logging out…" : (label ?? "Log out")}
    </button>
  );
}
