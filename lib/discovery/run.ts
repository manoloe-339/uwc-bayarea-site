/**
 * Run a discovery batch + log it.
 *  - Loop DISCOVERY_QUERIES, hit Serper + Exa for each
 *  - Parse LinkedIn /in/ URLs, normalize, dedupe per-query and globally
 *  - Triage against alumni + alumni_candidates
 *  - Insert new candidates
 *  - Persist run + per-query stats to discovery_runs / discovery_query_logs
 */

import Exa from "exa-js";
import { sql } from "@/lib/db";
import {
  DISCOVERY_QUERIES,
  normalizeLinkedinUrl,
  guessNameFromTitle,
} from "./queries";

const SERPER_COST = 0.001;
const EXA_COST = 0.005;

type RawHit = {
  url: string;
  title: string;
  snippet: string;
};

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

async function exaOne(q: string): Promise<{ hits: RawHit[]; error: string | null }> {
  try {
    const exa = new Exa(requireEnv("EXA_API_KEY"));
    const res = await exa.searchAndContents(q, {
      numResults: 10,
      type: "auto",
      text: { maxCharacters: 1000 },
      includeDomains: ["linkedin.com"],
    });
    return {
      hits: (res.results ?? []).map((r) => ({
        url: r.url ?? "",
        title: r.title ?? "",
        snippet: (r.text ?? "").slice(0, 500),
      })),
      error: null,
    };
  } catch (err) {
    return { hits: [], error: err instanceof Error ? err.message : "exa error" };
  }
}

export type DiscoveryRunResult = {
  run_id: number;
  total_hits: number;
  unique_urls: number;
  inserted: number;
  skipped_already_in_db: number;
  skipped_already_candidate: number;
  probable_matches: number;
  cost_usd: number;
};

/**
 * One run = open a discovery_runs row, fan out queries, record per-query
 * stats, triage hits, close the run row with totals.
 */
export async function runAndLogDiscoveryBatch(): Promise<DiscoveryRunResult> {
  const runRows = (await sql`
    INSERT INTO discovery_runs (started_at)
    VALUES (NOW())
    RETURNING id
  `) as { id: number }[];
  const runId = runRows[0].id;

  // Per (query, source) we'll accumulate: hits_returned, unique_urls,
  // and (after triage) new_in_db. Plus error, cost.
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

  // Each (query, source) keeps its own URL set so unique_linkedin_urls
  // counts within that one query+source combo.
  // Globally we also dedupe so the same URL doesn't get triage-tested twice.
  const globalByUrl = new Map<string, SourcedHit>();
  const sourcedByLog = new Map<string, Set<string>>(); // logKey -> set of urls in that log

  for (const { q, group } of DISCOVERY_QUERIES) {
    for (const source of ["serper", "exa"] as const) {
      const fn = source === "serper" ? serperOne : exaOne;
      const cost = source === "serper" ? SERPER_COST : EXA_COST;
      const { hits, error } = await fn(q);

      const localUrls = new Set<string>();
      for (const h of hits) {
        const url = normalizeLinkedinUrl(h.url);
        if (!url) continue;
        if (localUrls.has(url)) continue;
        localUrls.add(url);
        if (!globalByUrl.has(url)) {
          globalByUrl.set(url, { ...h, source, query: q, group });
        }
      }

      const logKey = `${q}::${source}`;
      sourcedByLog.set(logKey, localUrls);
      logs.push({
        query: q,
        source,
        group_label: group,
        hits_returned: hits.length,
        unique_linkedin_urls: localUrls.size,
        new_in_db: 0, // updated after triage
        cost_usd: cost,
        error,
      });
    }
  }

  // Triage globally-unique URLs against alumni + alumni_candidates.
  const allUrls = [...globalByUrl.keys()];
  let inserted = 0;
  let skippedInDb = 0;
  let skippedExistingCandidate = 0;
  let probableMatches = 0;

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
      SELECT id, LOWER(first_name) AS first, LOWER(last_name) AS last
      FROM alumni
      WHERE first_name IS NOT NULL AND last_name IS NOT NULL
    `) as { id: number; first: string | null; last: string | null }[];
    const fullNameIndex = new Map<string, number>();
    for (const a of allAlumni) {
      if (a.first && a.last) fullNameIndex.set(`${a.first} ${a.last}`, a.id);
    }

    // Track "new candidate" credit per (query, source) combo.
    const newCreditByLog = new Map<string, number>();

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
      let status: "new" | "probable_match" = "new";
      let matchedAlumniId: number | null = null;
      if (nameGuess) {
        const id = fullNameIndex.get(nameGuess.toLowerCase());
        if (id) {
          status = "probable_match";
          matchedAlumniId = id;
          probableMatches++;
        }
      }

      await sql`
        INSERT INTO alumni_candidates (
          linkedin_url, name_guess, title_snippet, body_snippet,
          source, search_query, status, matched_alumni_id
        ) VALUES (
          ${url}, ${nameGuess}, ${hit.title}, ${hit.snippet},
          ${hit.source}, ${hit.query}, ${status}, ${matchedAlumniId}
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
  const totalCost = logs.reduce((s, l) => s + l.cost_usd, 0);

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
      probable_matches = ${probableMatches},
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
    cost_usd: totalCost,
  };
}
