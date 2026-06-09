"use client";

interface Props {
  href: string;
  alumniId: number;
  /** Pixel size of the square icon. Default 16. */
  size?: number;
  className?: string;
}

/** Small blue "in" badge that opens LinkedIn AND beacons a log
 * event back to the directory so the admin audit captures "who is
 * this user actually trying to connect with". */
export default function LinkedinIconLink({
  href,
  alumniId,
  size = 16,
  className,
}: Props) {
  const onClick = () => {
    // Fire-and-forget. sendBeacon survives the immediate navigation
    // to linkedin.com and uses keepalive semantics.
    try {
      navigator.sendBeacon(
        "/api/directory/log-click",
        new Blob([JSON.stringify({ alumni_id: alumniId })], {
          type: "application/json",
        }),
      );
    } catch {
      // ignore — logging best-effort, never block the user's nav.
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      onAuxClick={onClick}
      onContextMenu={onClick}
      aria-label="LinkedIn profile"
      title="LinkedIn Profile"
      className={
        className ??
        `inline-flex items-center justify-center rounded-[3px] bg-[#0A66C2] text-white font-bold hover:brightness-110 leading-none`
      }
      style={
        className
          ? undefined
          : {
              width: size,
              height: size,
              fontSize: Math.max(9, Math.floor(size * 0.56)),
            }
      }
    >
      in
    </a>
  );
}
