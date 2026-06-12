"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

interface Props {
  /** Number of saves on the signed-in user's shortlist. Shown as a
   * small badge on the Saved tab when > 0. */
  savedCount: number;
  /** Whether to render the Saved tab. Shared-password sessions can't
   * use the shortlist feature, so we skip it for them. */
  showSaved: boolean;
}

/** Mobile-only 3-tab segmented nav: Search · Snapshot · Saved.
 * Active tab is whichever path the user is on (matched on the URL
 * prefix). Each tab is a real link to its own route. */
export default function MobileDirectoryNav({ savedCount, showSaved }: Props) {
  const pathname = usePathname() ?? "";
  const tabs: Array<{
    id: string;
    href: string;
    label: string;
    icon: IconName;
    iconFilled?: boolean;
    isActive: boolean;
    badge?: number;
  }> = [
    {
      id: "snapshot",
      href: "/directory/snapshot",
      label: "Snapshot",
      icon: "bar-chart",
      isActive: pathname.startsWith("/directory/snapshot"),
    },
    {
      id: "search",
      // The directory root IS the search view, so Search is active
      // only on the bare /directory route — detail pages
      // (/directory/[id]) leave it un-highlighted so tapping it
      // reads as "back to the list".
      href: "/directory",
      label: "Search",
      icon: "search",
      isActive: pathname === "/directory",
    },
  ];
  if (showSaved) {
    tabs.push({
      id: "saved",
      href: "/directory/saved",
      label: "Saved",
      icon: "star",
      iconFilled: pathname.startsWith("/directory/saved"),
      isActive: pathname.startsWith("/directory/saved"),
      badge: savedCount > 0 ? savedCount : undefined,
    });
  }
  // Re-order to the design's Search · Snapshot · Saved.
  const ORDER = ["search", "snapshot", "saved"];
  tabs.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  return (
    <div
      className="flex gap-[5px] mt-[15px] p-[5px] rounded-[14px]"
      style={{
        background: "rgba(255,255,255,.12)",
        border: "1px solid rgba(255,255,255,.2)",
      }}
    >
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`flex-1 inline-flex items-center justify-center gap-[7px] px-[6px] py-[11px] rounded-[10px] text-[14.5px] font-bold transition ${
            t.isActive
              ? "bg-white text-navy shadow-[0_1px_3px_rgba(2,28,56,.25)]"
              : "text-white/85"
          }`}
        >
          <Icon name={t.icon} size={16} filled={!!t.iconFilled} />
          {t.label}
          {t.badge != null && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-full bg-navy text-white text-[11px] font-extrabold leading-none">
              {t.badge > 99 ? "99+" : t.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
