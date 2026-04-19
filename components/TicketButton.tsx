"use client";

import { trackClick } from "./analytics/track";

export default function TicketButton({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackClick("ticket")}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
