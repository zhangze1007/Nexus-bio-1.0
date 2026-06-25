/**
 * citationVerifier — PubMed E-utilities citation verification.
 *
 * Verifies AI-generated citations against the NCBI PubMed database to
 * detect hallucinated or inaccurate references. Uses the E-utilities API
 * (eutils.ncbi.nlm.nih.gov/entrez/eutils) which is free and requires no
 * API key for moderate usage.
 *
 * Verification strategy:
 *   1. If the citation has a DOI, search PubMed by DOI first (most precise).
 *   2. Otherwise, search by title keywords (fuzzy match).
 *   3. Compare returned metadata (title, authors, year) against the citation.
 *   4. Mark as 'verified', 'unverified' (partial match), or 'not_found'.
 *
 * Rate limiting: NCBI allows 3 requests/second without an API key. We
 * enforce a 350ms minimum gap between requests and batch with delays.
 */

import type { CitationNode, CitationVerificationStatus } from "../types";

// ── PubMed E-utilities endpoints ─────────────────────────────────────────

const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
const EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

const RATE_LIMIT_MS = 350;
const REQUEST_TIMEOUT_MS = 8000;

// ── Types ────────────────────────────────────────────────────────────────

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  doi: string | null;
}

export interface VerificationResult {
  citationId: string;
  status: CitationVerificationStatus;
  pmid?: string;
  matchedTitle?: string;
  matchedAuthors?: string[];
  matchedYear?: number;
  matchedJournal?: string;
  matchScore?: number;
  error?: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────

let lastRequestTime = 0;

async function rateLimitedFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Combine external abort signal with our timeout
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/** Extract year from a PubMed article date string like "2023 Jun 15" or "2023" */
function extractYear(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const m = dateStr.match(/(\d{4})/);
  return m ? parseInt(m[1]) : 0;
}

/** Normalize a title for fuzzy comparison: lowercase, strip punctuation, collapse whitespace */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compute simple word-overlap similarity between two strings (0..1) */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(
    normalizeTitle(a)
      .split(" ")
      .filter((w) => w.length > 2),
  );
  const wordsB = new Set(
    normalizeTitle(b)
      .split(" ")
      .filter((w) => w.length > 2),
  );
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

/** Check if author names have meaningful overlap */
function authorOverlap(citationAuthors: string, pubmedAuthors: string[]): boolean {
  const citationNorm = citationAuthors.toLowerCase().replace(/[^a-z\s]/g, "");
  const lastNames = pubmedAuthors
    .map((a) => {
      const parts = a.trim().split(/\s+/);
      return parts[parts.length - 1]?.toLowerCase() ?? "";
    })
    .filter(Boolean);

  if (lastNames.length === 0) return false;

  // Check if at least one PubMed author last name appears in the citation string
  let matches = 0;
  for (const ln of lastNames) {
    if (ln.length > 2 && citationNorm.includes(ln)) matches++;
  }
  return matches >= Math.min(1, lastNames.length);
}

// ── PubMed search functions ──────────────────────────────────────────────

/**
 * Search PubMed by title keywords. Returns a list of PMIDs.
 */
async function searchByTitle(title: string, signal?: AbortSignal): Promise<string[]> {
  // Use first ~8 significant words to avoid over-specific queries
  const words = normalizeTitle(title)
    .split(" ")
    .filter((w) => w.length > 3)
    .slice(0, 8);
  if (words.length === 0) return [];

  const query = encodeURIComponent(words.join(" "));
  const url = `${ESEARCH_URL}?db=pubmed&term=${query}&retmax=5&retmode=json`;

  try {
    const res = await rateLimitedFetch(url, signal);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.esearchresult?.idlist ?? [];
  } catch {
    return [];
  }
}

/**
 * Search PubMed by DOI. Returns a single PMID or null.
 */
async function searchByDOI(doi: string, signal?: AbortSignal): Promise<string | null> {
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, "").trim();
  if (!cleanDoi) return null;

  const query = encodeURIComponent(`${cleanDoi}[doi]`);
  const url = `${ESEARCH_URL}?db=pubmed&term=${query}&retmax=1&retmode=json`;

  try {
    const res = await rateLimitedFetch(url, signal);
    if (!res.ok) return null;
    const data = await res.json();
    const ids = data?.esearchresult?.idlist ?? [];
    return ids.length > 0 ? ids[0] : null;
  } catch {
    return null;
  }
}

/**
 * Fetch article summaries from PubMed by PMID list.
 */
async function fetchSummaries(pmids: string[], signal?: AbortSignal): Promise<Map<string, PubMedArticle>> {
  const result = new Map<string, PubMedArticle>();
  if (pmids.length === 0) return result;

  const url = `${ESUMMARY_URL}?db=pubmed&id=${pmids.join(",")}&retmode=json`;

  try {
    const res = await rateLimitedFetch(url, signal);
    if (!res.ok) return result;
    const data = await res.json();

    for (const pmid of pmids) {
      const article = data?.result?.[pmid];
      if (!article || article.error) continue;

      const authors: string[] = (article.authors ?? [])
        .map((a: { name?: string; authtype?: string }) => a.name ?? "")
        .filter(Boolean);

      const title: string = article.title ?? "";
      const journal: string = article.fulljournalname ?? article.source ?? "";
      const year = extractYear(article.pubdate ?? article.sortpubdate ?? "");

      // Extract DOI from articleids
      const articleIds: Array<{ idtype: string; value: string }> = article.articleids ?? [];
      const doiEntry = articleIds.find((a) => a.idtype === "doi");
      const doi = doiEntry?.value ?? null;

      result.set(pmid, { pmid, title, authors, year, journal, doi });
    }
  } catch {
    // Return partial results on error
  }

  return result;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Verify a single citation against PubMed.
 *
 * Strategy:
 * 1. DOI lookup (if available) — highest precision
 * 2. Title search — fuzzy match with author/year cross-check
 *
 * Returns a VerificationResult with status and matched metadata.
 */
export async function verifyCitation(citation: CitationNode, signal?: AbortSignal): Promise<VerificationResult> {
  const base: VerificationResult = {
    citationId: citation.id,
    status: "not_found",
  };

  try {
    let pmid: string | null = null;

    // Strategy 1: DOI lookup
    if (citation.doi) {
      pmid = await searchByDOI(citation.doi, signal);
    }

    // Strategy 2: Title search
    if (!pmid && citation.title) {
      const pmids = await searchByTitle(citation.title, signal);
      if (pmids.length > 0) {
        // Fetch summaries and find best match
        const summaries = await fetchSummaries(pmids, signal);
        let bestPmid: string | null = null;
        let bestScore = 0;

        for (const [id, article] of summaries) {
          const titleSim = titleSimilarity(citation.title, article.title);
          const yearMatch = article.year === citation.year ? 0.15 : 0;
          const authorMatch = authorOverlap(citation.authors, article.authors) ? 0.15 : 0;
          const score = titleSim + yearMatch + authorMatch;

          if (score > bestScore) {
            bestScore = score;
            bestPmid = id;
          }
        }

        // Require minimum similarity threshold
        if (bestScore >= 0.45) {
          pmid = bestPmid;
        }
      }
    }

    if (!pmid) return base;

    // Fetch the matched article details
    const summaries = await fetchSummaries([pmid], signal);
    const article = summaries.get(pmid);
    if (!article) return { ...base, pmid };

    // Determine verification status
    const titleSim = titleSimilarity(citation.title, article.title);
    const yearMatches = article.year === citation.year || Math.abs(article.year - citation.year) <= 1;
    const authorMatch = authorOverlap(citation.authors, article.authors);

    let status: CitationVerificationStatus;
    if (titleSim >= 0.6 && (yearMatches || authorMatch)) {
      status = "verified";
    } else if (titleSim >= 0.35) {
      status = "unverified"; // partial match — may be related but not exact
    } else {
      status = "not_found";
    }

    return {
      citationId: citation.id,
      status,
      pmid: article.pmid,
      matchedTitle: article.title,
      matchedAuthors: article.authors,
      matchedYear: article.year,
      matchedJournal: article.journal,
      matchScore: titleSim,
    };
  } catch (e) {
    return {
      ...base,
      status: "not_found",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Batch-verify a list of citations against PubMed.
 *
 * Processes citations sequentially with rate limiting to respect NCBI's
 * 3 req/s limit. Returns results in the same order as input.
 */
export async function verifyCitationsBatch(
  citations: CitationNode[],
  signal?: AbortSignal,
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  for (const citation of citations) {
    if (signal?.aborted) break;
    const result = await verifyCitation(citation, signal);
    results.push(result);
  }

  return results;
}

/**
 * Merge verification results back into CitationNode objects.
 * Returns new objects (does not mutate input).
 */
export function mergeVerificationResults(citations: CitationNode[], results: VerificationResult[]): CitationNode[] {
  const resultMap = new Map(results.map((r) => [r.citationId, r]));

  return citations.map((citation) => {
    const result = resultMap.get(citation.id);
    if (!result) return citation;

    return {
      ...citation,
      pmid: result.pmid ?? citation.pmid,
      verificationStatus: result.status,
      journal: result.matchedJournal ?? citation.journal,
    };
  });
}

/**
 * Compute verification summary stats for a set of citations.
 */
export function computeVerificationSummary(citations: CitationNode[]): {
  total: number;
  verified: number;
  unverified: number;
  notFound: number;
  pending: number;
  verificationRate: number;
} {
  const total = citations.length;
  let verified = 0;
  let unverified = 0;
  let notFound = 0;
  let pending = 0;

  for (const c of citations) {
    switch (c.verificationStatus) {
      case "verified":
        verified++;
        break;
      case "unverified":
        unverified++;
        break;
      case "not_found":
        notFound++;
        break;
      default:
        pending++;
        break;
    }
  }

  return {
    total,
    verified,
    unverified,
    notFound,
    pending,
    verificationRate: total > 0 ? verified / total : 0,
  };
}
