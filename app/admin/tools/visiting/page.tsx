import { redirect } from "next/navigation";

// This route was renamed to /admin/tools/whatsapp (which now hosts
// "Just visiting" as one of three tabs). Preserve the old URL for
// any in-flight bookmarks / Manolo's email links.
export default function VisitingRedirect() {
  redirect("/admin/tools/whatsapp?tab=visiting");
}
