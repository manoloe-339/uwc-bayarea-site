import Link from "next/link";

type Tab = "campaigns" | "other" | "invite-lists" | "unsubscribes" | "settings" | "preview";

const TABS: { key: Tab; label: string; href: string }[] = [
  { key: "campaigns", label: "Campaigns", href: "/admin/email/campaigns" },
  { key: "other", label: "Other emails", href: "/admin/email/campaigns?view=other" },
  { key: "invite-lists", label: "Invite lists", href: "/admin/email/invite-lists" },
  { key: "unsubscribes", label: "Unsubscribes", href: "/admin/email/unsubscribes" },
  { key: "settings", label: "Settings", href: "/admin/email/settings" },
  { key: "preview", label: "Preview", href: "/admin/email/preview" },
];

export default function EmailTabs({ active }: { active: Tab }) {
  return (
    <div className="flex items-center gap-1 border-b border-[color:var(--rule)] mb-5">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            active === t.key
              ? "border-navy text-navy font-semibold"
              : "border-transparent text-[color:var(--muted)] hover:text-navy"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
