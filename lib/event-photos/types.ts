export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PhotoFilter = "all" | "pending" | "approved" | "rejected" | "duplicates";
export type DisplayRole = "marquee" | "supporting";

export interface EventPhoto {
  id: number;
  event_id: number;
  uploaded_by_attendee_id: number | null;
  uploaded_by_admin: boolean;
  blob_url: string;
  blob_pathname: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  content_type: string | null;
  width: number | null;
  height: number | null;
  uploaded_at: string;
  taken_at: string | null;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  notes: string | null;
  display_role: DisplayRole | null;
  display_order: number | null;
}

export interface PhotoStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  duplicates: number;
}
