"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createInviteList,
  deleteInviteList,
  removeMemberFromList,
  updateInviteListMeta,
  addMembersToList,
} from "@/lib/invite-lists";

function parseIds(raw: FormDataEntryValue | null): number[] {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function createListAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  const description = String(formData.get("description") ?? "").trim() || null;
  const eventDate = String(formData.get("event_date") ?? "").trim() || null;
  const eventLocation = String(formData.get("event_location") ?? "").trim() || null;

  // IDs can arrive as repeated "ids" fields (from the selection form) or a
  // single "ids" CSV string (from the fallback URL form).
  const all = formData.getAll("ids");
  const ids = all.flatMap((v) => parseIds(v));
  // De-dup
  const uniq = Array.from(new Set(ids));

  const id = await createInviteList({
    name,
    description,
    eventDate,
    eventLocation,
    alumniIds: uniq,
  });
  revalidatePath("/admin/events");
  redirect(`/admin/events/${id}`);
}

export async function updateListAction(
  listId: string,
  formData: FormData
): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  const description = String(formData.get("description") ?? "").trim() || null;
  const eventDate = String(formData.get("event_date") ?? "").trim() || null;
  const eventLocation = String(formData.get("event_location") ?? "").trim() || null;
  await updateInviteListMeta(listId, { name, description, eventDate, eventLocation });
  revalidatePath(`/admin/events/${listId}`);
  revalidatePath("/admin/events");
  redirect(`/admin/events/${listId}?saved=1`);
}

export async function deleteListAction(listId: string): Promise<void> {
  await deleteInviteList(listId);
  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export async function removeMemberAction(
  listId: string,
  alumniId: number
): Promise<void> {
  await removeMemberFromList(listId, alumniId);
  revalidatePath(`/admin/events/${listId}`);
}

export async function addMembersAction(
  listId: string,
  formData: FormData
): Promise<void> {
  const all = formData.getAll("ids");
  const ids = Array.from(new Set(all.flatMap((v) => parseIds(v))));
  await addMembersToList(listId, ids);
  revalidatePath(`/admin/events/${listId}`);
  redirect(`/admin/events/${listId}`);
}
