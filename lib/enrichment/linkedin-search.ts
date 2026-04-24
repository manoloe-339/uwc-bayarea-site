/**
 * Scenario B: we don't have a LinkedIn URL, so we have to find one.
 * Ports the multi-pass Serper + Exa fan-out from
 * scripts/discover_missing_linkedin.py and merges everything into a
 * single deduplicated candidate list for Claude to pick from.
 */

import Exa from "exa-js";
import type {
  BioSnippet,
  CandidateSource,
  LinkedinCandidate,
} from "@/types/enrichment";
import { ENRICHMENT_CONFIG, requireEnv, schoolVariants } from "./constants";

type SerperHit = { url: string; title: string; text: string };

const LINKEDIN_PROFILE_RE = /linkedin\.com\/in\//i;
const LINKEDIN_POST_HANDLE_RE =
  /^https?:\/\/(?:[a-z0-9]+\.)?linkedin\.com\/posts\/([^_/]+)_/i;

function cleanUrl(url: string): string {
  return url.trim().split("?", 1)[0].split("#", 1)[0];
}

/** Recover a profile URL from a LinkedIn post URL. Skips org handles. */
function profileFromPost(url: string): string | null {
  const m = url.match(LINKEDIN_POST_HANDLE_RE);
  if (!m) return null;
  const handle = m[1].toLowerCase();
  if (handle.startsWith("uwc") || handle.startsWith("the-mahindra") || handle.includes("-uwc-")) {
    return null;
  }
  return `https://www.linkedin.com/in/${m[1]}`;
}

/* ------------------------------------------------------------------ */
/* Serper                                                             */
/* ------------------------------------------------------------------ */

async function serperSearch(q: string, num = 10): Promise<SerperHit[]> {
  const key = requireEnv("SERPER_API_KEY");
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q, num }),
  });
  if (!res.ok) {
    throw new Error(`Serper ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { organic?: Array<{ link?: string; title?: string; snippet?: string }> };
  return (data.organic ?? []).map((it) => ({
    url: it.link ?? "",
    title: it.title ?? "",
    text: it.snippet ?? "",
  }));
}

/* ------------------------------------------------------------------ */
/* Exa                                                                */
/* ------------------------------------------------------------------ */

async function exaSearch(q: string): Promise<SerperHit[]> {
  const key = requireEnv("EXA_API_KEY");
  const exa = new Exa(key);
  try {
    const res = await exa.searchAndContents(q, {
      numResults: ENRICHMENT_CONFIG.EXA_RESULTS_PER_QUERY,
      type: "auto",
      text: { maxCharacters: 2000 },
      includeDomains: ["linkedin.com"],
    });
    return (res.results ?? []).map((r) => ({
      url: r.url ?? "",
      title: r.title ?? "",
      text: r.text ?? "",
    }));
  } catch (err) {
    console.error("[enrichment] Exa failed:", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Candidate builder                                                  */
/* ------------------------------------------------------------------ */

function addCandidate(
  map: Map<string, LinkedinCandidate>,
  raw: SerperHit,
  source: CandidateSource
): void {
  if (!raw.url) return;
  const cleaned = cleanUrl(raw.url);
  if (LINKEDIN_PROFILE_RE.test(cleaned)) {
    if (!map.has(cleaned)) {
      map.set(cleaned, {
        url: cleaned,
        title: raw.title,
        text: (raw.text ?? "").slice(0, 250),
        source,
      });
    }
    return;
  }
  const recovered = profileFromPost(cleaned);
  if (recovered && !map.has(recovered)) {
    map.set(recovered, {
      url: recovered,
      title: raw.title,
      text: (raw.text ?? "").slice(0, 250),
      source: source === "serper-quoted" ? "serper-quoted-post" : source,
    });
  }
}

function addBioSnippet(bios: BioSnippet[], raw: SerperHit): void {
  if (!raw.url) return;
  const cleaned = cleanUrl(raw.url);
  if (LINKEDIN_PROFILE_RE.test(cleaned)) return; // already captured as candidate
  if (bios.some((b) => b.url === cleaned)) return;
  bios.push({
    url: cleaned,
    title: raw.title,
    text: (raw.text ?? "").slice(0, 300),
  });
}

/**
 * Fan out across Serper passes 1a–1e + Exa. Returns deduped LinkedIn
 * profile candidates and (LinkedIn-ignoring) bio snippets that Claude
 * can use as identity context.
 */
export async function discoverCandidates(params: {
  name: string; // "First Last"
  college?: string | null;
  location?: string | null;
  email?: string | null;
}): Promise<{
  candidates: LinkedinCandidate[];
  bioSnippets: BioSnippet[];
}> {
  const name = params.name.trim();
  if (!name) return { candidates: [], bioSnippets: [] };

  const lastName = name.split(/\s+/).pop()?.toLowerCase() ?? "";
  const variants = schoolVariants(params.college);
  const candidates = new Map<string, LinkedinCandidate>();
  const bios: BioSnippet[] = [];

  // Pass 1a — "name" "school_variant" site:linkedin.com
  for (const v of variants) {
    try {
      const hits = await serperSearch(
        `"${name}" "${v}" site:linkedin.com`,
        ENRICHMENT_CONFIG.SERPER_RESULTS_PER_QUERY
      );
      for (const h of hits) addCandidate(candidates, h, "serper-quoted");
    } catch (err) {
      console.error("[enrichment] serper 1a:", err);
    }
  }

  // Pass 1b — "name" UWC site:linkedin.com
  try {
    const hits = await serperSearch(`"${name}" UWC site:linkedin.com`, 5);
    for (const h of hits) addCandidate(candidates, h, "serper-uwc");
  } catch (err) {
    console.error("[enrichment] serper 1b:", err);
  }

  // Pass 1c — "name" {location} site:linkedin.com/in/
  if (params.location) {
    try {
      const hits = await serperSearch(
        `"${name}" ${params.location} site:linkedin.com/in/`,
        5
      );
      for (const h of hits) addCandidate(candidates, h, "serper-location");
    } catch (err) {
      console.error("[enrichment] serper 1c:", err);
    }
  }

  // Pass 1d — broad: "name" "term"  (no site:filter) → candidates + bios
  const broadTerms = [...variants, "UWC"];
  for (const term of broadTerms) {
    try {
      const hits = await serperSearch(`"${name}" "${term}"`, 8);
      for (const h of hits) {
        addCandidate(candidates, h, "serper-broad");
        addBioSnippet(bios, h);
      }
    } catch (err) {
      console.error("[enrichment] serper 1d:", err);
    }
  }

  // Pass 1e — Davis Scholar catch
  try {
    const quoted = await serperSearch(`"${name}" "davis scholar"`, 8);
    for (const h of quoted) addCandidate(candidates, h, "serper-davis");
    const bare = await serperSearch(`${name} "davis scholar"`, 8);
    for (const h of bare) addCandidate(candidates, h, "serper-davis");
  } catch (err) {
    console.error("[enrichment] serper 1e:", err);
  }

  // Exa semantic fan-out (LinkedIn only), with last-name drift filter.
  const exaQueries = variants.map((v) => `${name} ${v}`);
  if (params.location) exaQueries.push(`${name} ${params.location}`);
  for (const q of exaQueries) {
    const hits = await exaSearch(q);
    for (const h of hits) {
      const url = (h.url ?? "").toLowerCase();
      const title = (h.title ?? "").toLowerCase();
      const text = (h.text ?? "").slice(0, 300).toLowerCase();
      const isTargetPost = profileFromPost(h.url) != null;
      if (
        lastName &&
        !url.includes(lastName) &&
        !title.includes(lastName) &&
        !text.includes(lastName) &&
        !isTargetPost
      ) {
        continue; // drop — Exa's semantic matching surfaced a different person
      }
      addCandidate(candidates, h, "exa");
    }
  }

  return {
    candidates: Array.from(candidates.values()).slice(0, ENRICHMENT_CONFIG.MAX_CANDIDATES_TO_CLAUDE),
    bioSnippets: bios.slice(0, 5),
  };
}
