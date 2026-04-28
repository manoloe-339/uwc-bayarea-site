/**
 * Run a discovery batch:
 *  - Loop the DISCOVERY_QUERIES list, hit Serper + Exa for each,
 *  - parse out LinkedIn /in/ URLs (with title + snippet),
 *  - normalize + dedup,
 *  - hand off to triage.
 */

import Exa from "exa-js";
import { sql } from "@/lib/db";
import {
  DISCOVERY_QUERIES,
  normalizeLinkedinUrl,
  guessNameFromTitle,
} from "./queries";

type Hit = {
  url: string;
  title: string;
  snippet: string;
  source: "serper" | "exa";
  query: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

async function serperOne(q: string): Promise<Hit[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": requireEnv("SERPER_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({ q, num: 10 }),
  });
  if (!res.ok) {
    console.error(`[discovery] Serper ${res.status} for "${q}"`);
    return [];
  }
  const data = (await res.json()) as { organic?: Array<{ link?: string; title?: string; snippet?: string }> };
  return (data.organic ?? []).map((it) => ({
    url: it.link ?? "",
    title: it.title ?? "",
    snippet: it.snippet ?? "",
    source: "serper" as const,
    query: q,
  }));
}

async function exaOne(q: string): Promise<Hit[]> {
  try {
    const exa = new Exa(requireEnv("EXA_API_KEY"));
    const res = await exa.searchAndContents(q, {
      numResults: 10,
      type: "auto",
      text: { maxCharacters: 1000 },
      includeDomains: ["linkedin.com"],
    });
    return (res.results ?? []).map((r) => ({
      url: r.url ?? "",
      title: r.title ?? "",
      snippet: (r.text ?? "").slice(0, 500),
      source: "exa" as const,
      query: q,
    }));
  } catch (err) {
    console.error(`[discovery] Exa failed for "${q}":`, err);
    return [];
  }
}

export type DiscoveryHit = {
  linkedinUrl: string;
  nameGuess: string | null;
  title: string;
  snippet: string;
  source: "serper" | "exa";
  query: string;
};

/**
 * Hit Serper + Exa for every query in DISCOVERY_QUERIES, dedupe by
 * normalized LinkedIn URL.
 */
export async function runDiscoveryBatch(): Promise<DiscoveryHit[]> {
  const allHits: Hit[] = [];
  for (const { q } of DISCOVERY_QUERIES) {
    // Serial — Serper rate-limits free tier; small total volume so OK.
    const [s, e] = await Promise.all([serperOne(q), exaOne(q)]);
    allHits.push(...s, ...e);
  }

  const byUrl = new Map<string, DiscoveryHit>();
  for (const h of allHits) {
    const url = normalizeLinkedinUrl(h.url);
    if (!url) continue;
    if (byUrl.has(url)) continue; // first hit wins
    byUrl.set(url, {
      linkedinUrl: url,
      nameGuess: guessNameFromTitle(h.title),
      title: h.title,
      snippet: h.snippet,
      source: h.source,
      query: h.query,
    });
  }
  return [...byUrl.values()];
}

export type TriageOutcome = {
  inserted: number;
  skipped_already_in_db: number;
  skipped_already_candidate: number;
  probable_matches: number;
};

/**
 * Match each discovered URL against:
 *   - alumni.linkedin_url (already in DB → skip)
 *   - existing alumni_candidates row (already discovered → skip, but
 *     update reviewed_at if it was 'rejected' so the admin can notice)
 *   - alumni first_name+last_name fuzzy match (probable_match status)
 * Insert the rest as new candidates.
 */
export async function triageAndStore(hits: DiscoveryHit[]): Promise<TriageOutcome> {
  const out: TriageOutcome = {
    inserted: 0,
    skipped_already_in_db: 0,
    skipped_already_candidate: 0,
    probable_matches: 0,
  };
  if (hits.length === 0) return out;

  const urls = hits.map((h) => h.linkedinUrl);

  // Build lookup of URLs already on alumni or already-candidate rows.
  const inAlumni = (await sql`
    SELECT id, LOWER(linkedin_url) AS u
    FROM alumni
    WHERE linkedin_url IS NOT NULL AND LOWER(linkedin_url) = ANY(${urls})
  `) as { id: number; u: string }[];
  const alumniByUrl = new Map(inAlumni.map((r) => [r.u, r.id]));

  const inCandidates = (await sql`
    SELECT linkedin_url FROM alumni_candidates WHERE linkedin_url = ANY(${urls})
  `) as { linkedin_url: string }[];
  const existingCandidateUrls = new Set(inCandidates.map((r) => r.linkedin_url));

  // Cheap name index for fuzzy match — just a single SELECT of all
  // (id, first_name, last_name) lower-cased. The DB has ~400 alumni;
  // this is fine.
  const allAlumni = (await sql`
    SELECT id, LOWER(first_name) AS first, LOWER(last_name) AS last
    FROM alumni
    WHERE first_name IS NOT NULL AND last_name IS NOT NULL
  `) as { id: number; first: string | null; last: string | null }[];
  const fullNameIndex = new Map<string, number>();
  for (const a of allAlumni) {
    if (a.first && a.last) fullNameIndex.set(`${a.first} ${a.last}`, a.id);
  }

  for (const h of hits) {
    if (alumniByUrl.has(h.linkedinUrl)) {
      out.skipped_already_in_db++;
      continue;
    }
    if (existingCandidateUrls.has(h.linkedinUrl)) {
      out.skipped_already_candidate++;
      continue;
    }

    let status: "new" | "probable_match" = "new";
    let matchedAlumniId: number | null = null;
    if (h.nameGuess) {
      const lc = h.nameGuess.toLowerCase();
      const id = fullNameIndex.get(lc);
      if (id) {
        status = "probable_match";
        matchedAlumniId = id;
        out.probable_matches++;
      }
    }

    await sql`
      INSERT INTO alumni_candidates (
        linkedin_url, name_guess, title_snippet, body_snippet,
        source, search_query, status, matched_alumni_id
      ) VALUES (
        ${h.linkedinUrl}, ${h.nameGuess}, ${h.title}, ${h.snippet},
        ${h.source}, ${h.query}, ${status}, ${matchedAlumniId}
      )
      ON CONFLICT (linkedin_url) DO NOTHING
    `;
    out.inserted++;
  }

  return out;
}
