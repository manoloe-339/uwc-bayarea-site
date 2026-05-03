/**
 * Heuristic "are these effectively the same name?" matcher used to
 * decide whether to show a secondary "purchaser" / "alumni" line
 * beside a primary display name. No nickname dictionary — catches
 * accent / middle-initial / punctuation / partial-name variants but
 * NOT nickname variants (Bob/Robert, Liz/Elizabeth, etc.).
 */

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[.,'`’]/g, "") // strip common punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a normalized name into significant tokens — drops single-letter
 * middle initials so "John A. Smith" → ["john", "smith"]. */
function tokens(name: string): string[] {
  return normalize(name)
    .split(" ")
    .filter((t) => t.length > 1);
}

export function namesEffectivelyMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;

  // Single-token compare (e.g. "Maria" vs "Maria")
  if (ta.length === 1 && tb.length === 1) return ta[0] === tb[0];

  // Multi-token: most discriminating signal is first + last token
  const aFirst = ta[0];
  const aLast = ta[ta.length - 1];
  const bFirst = tb[0];
  const bLast = tb[tb.length - 1];
  if (aFirst === bFirst && aLast === bLast) return true;

  // One side is just a first name, the other is full — match if first names align
  if (ta.length === 1 && tb[0] === ta[0]) return true;
  if (tb.length === 1 && ta[0] === tb[0]) return true;

  return false;
}
