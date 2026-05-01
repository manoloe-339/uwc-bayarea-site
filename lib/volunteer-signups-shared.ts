/** Client-safe types and constants for the volunteer signup flow.
 * Lives separately from lib/volunteer-signups.ts so the public form
 * (a client component) can import these without dragging the Neon SQL
 * client into the browser bundle. */

export type VolunteerArea = "national" | "outreach" | "events" | "donors" | "other";

export const VOLUNTEER_AREAS: { value: VolunteerArea; label: string; desc: string }[] = [
  { value: "national", label: "A national committee", desc: "Interview, review, and select students." },
  { value: "outreach", label: "Encourage local students to apply", desc: "Work with our admissions teams." },
  { value: "events", label: "Organizing Bay Area events", desc: "Plan dinners, mixers, send-offs." },
  { value: "donors", label: "Working with donors", desc: "Steward, thank, fundraise." },
  { value: "other", label: "Something else", desc: "Tell us in the box below." },
];

export interface AlumniLookupResult {
  status: "match" | "nomatch";
  member?: {
    id: number;
    name: string;
    school: string | null;
    year: number | null;
  };
}
