"use client";

import { useState } from "react";

/** Client-side wrapper that lets the parent saved-row hide itself
 * when the user unsaves (via SaveStar's onSavedChange callback) and
 * reappear on undo. The full row JSX is passed as children so the
 * saved page can keep its server-rendered structure. */
export default function SavedRowWrapper({
  children,
}: {
  children: (
    onSavedChange: (saved: boolean) => void,
  ) => React.ReactNode;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <>{children((s) => setVisible(s))}</>;
}
