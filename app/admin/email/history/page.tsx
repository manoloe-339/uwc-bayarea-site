import { redirect } from "next/navigation";

export default function LegacyHistory(): never {
  redirect("/admin/email/campaigns");
}
