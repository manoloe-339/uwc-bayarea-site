import { sql } from "./db";

export type InviteListRow = {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  event_location: string | null;
  original_query: string | null;
  created_at: string;
  updated_at: string;
};

export type InviteListWithCount = InviteListRow & {
  member_count: number;
};

export type InviteListMember = {
  id: string;
  list_id: string;
  alumni_id: number;
  added_at: string;
  match_score: number | null;
  match_reason: string | null;
  status: string;
  // Alumni join fields
  first_name: string | null;
  last_name: string | null;
  email: string;
  photo_url: string | null;
  linkedin_url: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  location_city: string | null;
};

export async function listAllInviteLists(): Promise<InviteListWithCount[]> {
  const rows = (await sql`
    SELECT l.*, (
      SELECT COUNT(*)::int FROM event_invite_list_members m WHERE m.list_id = l.id
    ) AS member_count
    FROM event_invite_lists l
    ORDER BY l.created_at DESC
  `) as InviteListWithCount[];
  return rows;
}

export async function getInviteList(id: string): Promise<InviteListRow | null> {
  const rows = (await sql`SELECT * FROM event_invite_lists WHERE id = ${id}`) as InviteListRow[];
  return rows[0] ?? null;
}

export async function getInviteListMembers(listId: string): Promise<InviteListMember[]> {
  const rows = (await sql`
    SELECT
      m.id, m.list_id, m.alumni_id, m.added_at, m.match_score, m.match_reason, m.status,
      a.first_name, a.last_name, a.email, a.photo_url, a.linkedin_url,
      a.headline, a.current_title, a.current_company, a.location_city
    FROM event_invite_list_members m
    JOIN alumni a ON a.id = m.alumni_id
    WHERE m.list_id = ${listId}
    ORDER BY m.match_score DESC NULLS LAST, a.last_name ASC NULLS LAST, a.first_name ASC NULLS LAST
  `) as InviteListMember[];
  return rows;
}

export async function createInviteList(params: {
  name: string;
  description?: string | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  originalQuery?: string | null;
  alumniIds: number[];
}): Promise<string> {
  const rows = (await sql`
    INSERT INTO event_invite_lists (name, description, event_date, event_location, original_query)
    VALUES (
      ${params.name},
      ${params.description ?? null},
      ${params.eventDate ?? null},
      ${params.eventLocation ?? null},
      ${params.originalQuery ?? null}
    )
    RETURNING id
  `) as { id: string }[];
  const listId = rows[0].id;
  if (params.alumniIds.length > 0) {
    await addMembersToList(listId, params.alumniIds);
  }
  return listId;
}

export async function updateInviteListMeta(
  id: string,
  params: {
    name?: string;
    description?: string | null;
    eventDate?: string | null;
    eventLocation?: string | null;
  }
): Promise<void> {
  await sql`
    UPDATE event_invite_lists SET
      name           = COALESCE(${params.name ?? null}, name),
      description    = ${params.description ?? null},
      event_date     = ${params.eventDate ?? null},
      event_location = ${params.eventLocation ?? null},
      updated_at     = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteInviteList(id: string): Promise<void> {
  await sql`DELETE FROM event_invite_lists WHERE id = ${id}`;
}

export async function addMembersToList(
  listId: string,
  alumniIds: number[]
): Promise<number> {
  if (alumniIds.length === 0) return 0;
  // ON CONFLICT handles repeat-adds cleanly.
  const rows = (await sql`
    INSERT INTO event_invite_list_members (list_id, alumni_id)
    SELECT ${listId}, id FROM alumni WHERE id = ANY(${alumniIds})
    ON CONFLICT (list_id, alumni_id) DO NOTHING
    RETURNING id
  `) as { id: string }[];
  await sql`UPDATE event_invite_lists SET updated_at = NOW() WHERE id = ${listId}`;
  return rows.length;
}

export async function removeMemberFromList(
  listId: string,
  alumniId: number
): Promise<void> {
  await sql`
    DELETE FROM event_invite_list_members
    WHERE list_id = ${listId} AND alumni_id = ${alumniId}
  `;
  await sql`UPDATE event_invite_lists SET updated_at = NOW() WHERE id = ${listId}`;
}
