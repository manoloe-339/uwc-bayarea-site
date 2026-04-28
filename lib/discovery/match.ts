/**
 * Name-matching helpers for triaging discovered LinkedIn URLs against
 * the existing alumni table.
 *
 * Strengths:
 *   1. linkedin_url exact (handled outside this module)
 *   2. full normalized name (first + last) — strongest name signal
 *   3. last name + first initial — catches nicknames (Bob/Robert)
 *
 * Married/maiden names are not handled at this stage — there's no
 * signal in a search snippet. Defer to post-scrape verification.
 */

export type AlumniIndex = {
  fullNameToId: Map<string, number>;       // "lale quezada" -> 12
  lastInitialToId: Map<string, number[]>;  // "quezada|l" -> [12, 47]
};

/** Strip diacritics + lowercase + collapse whitespace. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s'\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract (firstWord, lastWord) from a parsed name. Drops middles. */
export function splitNameWords(name: string): { first: string; last: string } | null {
  const norm = normalizeName(name);
  if (!norm) return null;
  const parts = norm.split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (first.length < 2 || last.length < 2) return null;
  return { first, last };
}

export function buildAlumniIndex(
  rows: Array<{ id: number; first_name: string | null; last_name: string | null }>
): AlumniIndex {
  const fullNameToId = new Map<string, number>();
  const lastInitialToId = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.first_name || !r.last_name) continue;
    const fn = normalizeName(r.first_name);
    const ln = normalizeName(r.last_name);
    if (!fn || !ln) continue;
    const fnFirstWord = fn.split(" ")[0];
    const lnLastWord = ln.split(" ").slice(-1)[0];
    if (fnFirstWord && lnLastWord) {
      fullNameToId.set(`${fnFirstWord} ${lnLastWord}`, r.id);
      const key = `${lnLastWord}|${fnFirstWord[0]}`;
      const arr = lastInitialToId.get(key) ?? [];
      arr.push(r.id);
      lastInitialToId.set(key, arr);
    }
  }
  return { fullNameToId, lastInitialToId };
}

export type MatchResult =
  | { kind: "none" }
  | { kind: "probable_match"; alumni_id: number }
  | { kind: "possible_match"; alumni_id: number };

/**
 * Try to match a guessed name from a search snippet against the alumni
 * index. Returns the strongest match found.
 */
export function matchName(name: string | null, index: AlumniIndex): MatchResult {
  if (!name) return { kind: "none" };
  const split = splitNameWords(name);
  if (!split) return { kind: "none" };

  // Strongest: full first+last word match.
  const full = `${split.first} ${split.last}`;
  const fullId = index.fullNameToId.get(full);
  if (fullId) return { kind: "probable_match", alumni_id: fullId };

  // Mid: last name + first initial. Picks up "Bob Johnson" matching DB
  // "Robert Johnson". Only flag if there's exactly one such candidate;
  // ambiguous matches (multiple alumni with last+initial) we skip to
  // avoid noise.
  const initialKey = `${split.last}|${split.first[0]}`;
  const possibles = index.lastInitialToId.get(initialKey);
  if (possibles && possibles.length === 1) {
    return { kind: "possible_match", alumni_id: possibles[0] };
  }
  return { kind: "none" };
}

/**
 * Post-filter Exa results: require at least one of the quoted phrases
 * from the original query to literally appear in title or snippet.
 *
 * Why: Exa is a semantic search and largely ignores quotes. So a query
 * like `"UWC Costa Rica" "Bay Area"` can return profiles in Costa Rica
 * with no UWC mention. This guards against that.
 */
export function exaPhraseFilter(
  query: string,
  hit: { title: string; snippet: string }
): boolean {
  // Pull all "quoted phrases" out of the query. If there are none,
  // accept everything.
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
  if (phrases.length === 0) return true;
  const haystack = `${hit.title} ${hit.snippet}`.toLowerCase();
  return phrases.some((p) => haystack.includes(p));
}
