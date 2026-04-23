export const RELATIONSHIP_OPTIONS = [
  { value: "spouse_partner", label: "Spouse / Partner" },
  { value: "friend", label: "Friend" },
  { value: "colleague", label: "Colleague" },
  { value: "family", label: "Family member" },
  { value: "other", label: "Other" },
] as const;

export function relationshipLabel(type: string | null): string {
  if (!type) return "";
  const o = RELATIONSHIP_OPTIONS.find((x) => x.value === type);
  return o?.label ?? type;
}
