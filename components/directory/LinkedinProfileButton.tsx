"use client";

interface Props {
  href: string;
  alumniId: number;
}

/** Big blue "LinkedIn Profile" button used on the profile detail
 * page. Beacons the connect-intent log on click before navigating. */
export default function LinkedinProfileButton({ href, alumniId }: Props) {
  const onClick = () => {
    try {
      navigator.sendBeacon(
        "/api/directory/log-click",
        new Blob([JSON.stringify({ alumni_id: alumniId })], {
          type: "application/json",
        }),
      );
    } catch {
      // best-effort
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
      className="inline-flex items-center gap-2 bg-[#0A66C2] text-white px-4 py-2 rounded text-xs font-bold tracking-[.18em] uppercase hover:opacity-90"
    >
      LinkedIn Profile
    </a>
  );
}
