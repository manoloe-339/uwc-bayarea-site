import type { ReactNode } from "react";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function CheckinLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-ivory">{children}</div>;
}
