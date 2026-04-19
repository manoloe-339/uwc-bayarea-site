export const UNSUBSCRIBE_REASONS = [
  { code: "moved",       label: "I no longer live in the area" },
  { code: "frequency",   label: "Too many emails" },
  { code: "relevance",   label: "Content isn't relevant to me" },
  { code: "never",       label: "I never signed up for this" },
  { code: "aged_out",    label: "I'm graduating out of this group / no longer an alum participant" },
  { code: "other",       label: "Other" },
] as const;

export type UnsubscribeReasonCode =
  | (typeof UNSUBSCRIBE_REASONS)[number]["code"]
  | "not_provided";

export function reasonLabel(code: string | null | undefined): string {
  if (!code) return "—";
  if (code === "not_provided") return "Not provided";
  const r = UNSUBSCRIBE_REASONS.find((x) => x.code === code);
  return r?.label ?? code;
}
