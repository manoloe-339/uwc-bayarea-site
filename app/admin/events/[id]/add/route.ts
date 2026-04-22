import { NextResponse, type NextRequest } from "next/server";
import { addMembersToList, getInviteList } from "@/lib/invite-lists";

/**
 * GET /admin/events/:id/add?ids=1,2,3&ids=4
 * Adds the given alumni to the list and redirects to the list detail page.
 * Called from the alumni search form when the page is in "adding to list"
 * mode (addToList query param set).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const list = await getInviteList(id);
  if (!list) {
    return NextResponse.redirect(new URL("/admin/events", req.url));
  }
  const ids = req.nextUrl.searchParams
    .getAll("ids")
    .flatMap((v) => v.split(","))
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  await addMembersToList(id, Array.from(new Set(ids)));
  return NextResponse.redirect(new URL(`/admin/events/${id}`, req.url));
}
