/**
 * Run a discovery batch + log it.
 *  - Loop DISCOVERY_QUERIES, hit Serper + Exa for each
 *  - Post-filter Exa: require quoted phrases to literally appear (it's
 *    semantic, not keyword)
 *  - Parse LinkedIn /in/ URLs, normalize, dedupe per-query and globally
 *  - Claude-triage each unique URL (alum vs teacher; bay area vs not)
 *  - Match against alumni table (full name + last+initial)
 *  - Insert new candidates with triage + match annotations
 *  - Persist run + per-query stats to discovery_runs / discovery_query_logs
 */

import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@/lib/db";
import {
  DISCOVERY_QUERIES,
  normalizeLinkedinUrl,
  guessNameFromTitle,
} from "./queries";
import { triageHit, type TriageResult } from "./triage-llm";
import { buildAlumniIndex, matchName } from "./match";

const SERPER_COST = 0.001;
const CLAUDE_TRIAGE_COST = 0.0001;

// "University of the Western Cape" (also "UWC") is a South African
// university unrelated to United World Colleges. Drop hits that match.
const WESTERN_CAPE_RE = /university of the western cape|western\s*cape/i;
function isWesternCapeFalsePositive(hit: { title: string; snippet: string }): boolean {
  return WESTERN_CAPE_RE.test(hit.title) || WESTERN_CAPE_RE.test(hit.snippet);
}

type RawHit = { url: string; title: string; snippet: string };
type SourcedHit = RawHit & {
  source: "serper" | "exa";
  query: string;
  group: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

async function serperOne(q: string): Promise<{ hits: RawHit[]; error: string | null }> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": requireEnv("SERPER_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({ q, num: 10 }),
    });
    if (!res.ok) {
      return { hits: [], error: `Serper ${res.status}` };
    }
    const data = (await res.json()) as { organic?: Array<{ link?: string; title?: string; snippet?: string }> };
    return {
      hits: (data.organic ?? []).map((it) => ({
        url: it.link ?? "",
        title: it.title ?? "",
        snippet: it.snippet ?? "",
      })),
      error: null,
    };
  } catch (err) {
    return { hits: [], error: err instanceof Error ? err.message : "serper error" };
  }
}

// Exa was disabled in V2 — its semantic-search behavior returned too
// many false positives even after phrase post-filtering. Keep the
// import path warm via match.ts in case we re-enable later.

export type DiscoveryRunResult = {
  run_id: number;
  total_hits: number;
  unique_urls: number;
  inserted: number;
  skipped_already_in_db: number;
  skipped_already_candidate: number;
  probable_matches: number;
  possible_matches: number;
  cost_usd: number;
};

export async function runAndLogDiscoveryBatch(): Promise<DiscoveryRunResult> {
  const runRows = (await sql`
    INSERT INTO discovery_runs (started_at) VALUES (NOW()) RETURNING id
  `) as { id: number }[];
  const runId = runRows[0].id;

  type LogEntry = {
    query: string;
    source: "serper" | "exa";
    group_label: string;
    hits_returned: number;
    unique_linkedin_urls: number;
    new_in_db: number;
    cost_usd: number;
    error: string | null;
  };
  const logs: LogEntry[] = [];

  const globalByUrl = new Map<string, SourcedHit>();

  for (const { q, group } of DISCOVERY_QUERIES) {
    const { hits: rawHits, error } = await serperOne(q);
    // Drop Western Cape (different UWC) before anything else.
    const hits = rawHits.filter((h) => !isWesternCapeFalsePositive(h));

    const localUrls = new Set<string>();
    for (const h of hits) {
      const url = normalizeLinkedinUrl(h.url);
      if (!url) continue;
      if (localUrls.has(url)) continue;
      localUrls.add(url);
      if (!globalByUrl.has(url)) {
        globalByUrl.set(url, { ...h, source: "serper", query: q, group });
      }
    }

    logs.push({
      query: q,
      source: "serper",
      group_label: group,
      hits_returned: hits.length,
      unique_linkedin_urls: localUrls.size,
      new_in_db: 0,
      cost_usd: SERPER_COST,
      error,
    });
  }

  // Triage URLs against alumni + alumni_candidates first, so we only
  // hit Claude on URLs that will actually become candidates.
  const allUrls = [...globalByUrl.keys()];
  let inserted = 0;
  let skippedInDb = 0;
  let skippedExistingCandidate = 0;
  let probableMatches = 0;
  let possibleMatches = 0;
  let triageCost = 0;

  if (allUrls.length > 0) {
    const inAlumni = (await sql`
      SELECT LOWER(linkedin_url) AS u
      FROM alumni
      WHERE linkedin_url IS NOT NULL AND LOWER(linkedin_url) = ANY(${allUrls})
    `) as { u: string }[];
    const inDbSet = new Set(inAlumni.map((r) => r.u));

    const inCandidates = (await sql`
      SELECT linkedin_url FROM alumni_candidates WHERE linkedin_url = ANY(${allUrls})
    `) as { linkedin_url: string }[];
    const existingCandidateSet = new Set(inCandidates.map((r) => r.linkedin_url));

    const allAlumni = (await sql`
      SELECT id, first_name, last_name FROM alumni
      WHERE first_name IS NOT NULL AND last_name IS NOT NULL
    `) as { id: number; first_name: string | null; last_name: string | null }[];
    const alumniIndex = buildAlumniIndex(allAlumni);

    const newCreditByLog = new Map<string, number>();
    const anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

    for (const [url, hit] of globalByUrl.entries()) {
      if (inDbSet.has(url)) {
        skippedInDb++;
        continue;
      }
      if (existingCandidateSet.has(url)) {
        skippedExistingCandidate++;
        continue;
      }

      const nameGuess = guessNameFromTitle(hit.title);
      const match = matchName(nameGuess, alumniIndex);

      let status: "new" | "probable_match" | "possible_match" = "new";
      let matchedAlumniId: number | null = null;
      if (match.kind === "probable_match") {
        status = "probable_match";
        matchedAlumniId = match.alumni_id;
        probableMatches++;
      } else if (match.kind === "possible_match") {
        status = "possible_match";
        matchedAlumniId = match.alumni_id;
        possibleMatches++;
      }

      // Claude triage. Fire-and-fail-safe: if it errors, store the
      // candidate without triage info (Anthropic may be down etc.).
      let triage: TriageResult | null = null;
      try {
        triage = await triageHit(anthropic, {
          url,
          title: hit.title,
          snippet: hit.snippet,
        });
        triageCost += CLAUDE_TRIAGE_COST;
      } catch {
        // already logged inside triageHit
      }

      await sql`
        INSERT INTO alumni_candidates (
          linkedin_url, name_guess, title_snippet, body_snippet,
          source, search_query, status, matched_alumni_id,
          triage_confidence, triage_role, triage_reasoning, run_id
        ) VALUES (
          ${url}, ${nameGuess}, ${hit.title}, ${hit.snippet},
          ${hit.source}, ${hit.query}, ${status}, ${matchedAlumniId},
          ${triage?.confidence ?? null}, ${triage?.role ?? null}, ${triage?.reasoning ?? null},
          ${runId}
        )
        ON CONFLICT (linkedin_url) DO NOTHING
      `;
      inserted++;
      const k = `${hit.query}::${hit.source}`;
      newCreditByLog.set(k, (newCreditByLog.get(k) ?? 0) + 1);
    }

    for (const log of logs) {
      const k = `${log.query}::${log.source}`;
      log.new_in_db = newCreditByLog.get(k) ?? 0;
    }
  }

  const totalHits = logs.reduce((s, l) => s + l.hits_returned, 0);
  const uniqueUrls = globalByUrl.size;
  const totalCost = logs.reduce((s, l) => s + l.cost_usd, 0) + triageCost;

  for (const log of logs) {
    await sql`
      INSERT INTO discovery_query_logs (
        run_id, query, source, group_label,
        hits_returned, unique_linkedin_urls, new_in_db, cost_usd, error
      ) VALUES (
        ${runId}, ${log.query}, ${log.source}, ${log.group_label},
        ${log.hits_returned}, ${log.unique_linkedin_urls}, ${log.new_in_db},
        ${log.cost_usd}, ${log.error}
      )
    `;
  }

  await sql`
    UPDATE discovery_runs SET
      finished_at = NOW(),
      total_queries = ${DISCOVERY_QUERIES.length},
      total_hits = ${totalHits},
      unique_urls = ${uniqueUrls},
      new_candidates = ${inserted},
      probable_matches = ${probableMatches + possibleMatches},
      skipped_in_db = ${skippedInDb},
      skipped_existing_candidate = ${skippedExistingCandidate},
      cost_usd = ${totalCost}
    WHERE id = ${runId}
  `;

  return {
    run_id: runId,
    total_hits: totalHits,
    unique_urls: uniqueUrls,
    inserted,
    skipped_already_in_db: skippedInDb,
    skipped_already_candidate: skippedExistingCandidate,
    probable_matches: probableMatches,
    possible_matches: possibleMatches,
    cost_usd: totalCost,
  };
}
