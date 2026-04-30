/**
 * Helpers for pulling the freeform UWC info attendees enter at Stripe
 * checkout (custom field). Used to seed name tags when the attendee
 * isn't matched to an alumni record.
 */

/** Pull the raw UWC custom-field value from a Stripe checkout session. */
export function extractUwcField(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const f of raw) {
    if (!f || typeof f !== "object") continue;
    const obj = f as {
      key?: string;
      label?: { custom?: string | null } | null;
      text?: { value?: string | null } | null;
      dropdown?: { value?: string | null } | null;
      numeric?: { value?: string | null } | null;
    };
    const key = (obj.key ?? "").toLowerCase();
    const label = (obj.label?.custom ?? "").toLowerCase();
    if (!key.includes("uwc") && !label.includes("uwc")) continue;
    const value = obj.text?.value ?? obj.dropdown?.value ?? obj.numeric?.value ?? null;
    if (value && value.trim()) return value.trim();
  }
  return null;
}
