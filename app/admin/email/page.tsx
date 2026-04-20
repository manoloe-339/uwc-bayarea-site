import { redirect } from "next/navigation";

// Old quick-compose landing — superseded by the campaigns flow.
export default function LegacyEmailLanding(): never {
  redirect("/admin/email/campaigns");
}
