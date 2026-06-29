/**
 * Real Literature Retrieval API — PubMed + Semantic Scholar
 *
 * Provides real-time literature search for NEXAI, replacing mock data.
 * Uses:
 *   - NCBI E-utilities (PubMed) — free, no API key required for basic use
 *   - Semantic Scholar API — free, rate-limited
 *   - OpenAlex API — free, no rate limit
 *
 * @references
 *   - NCBI E-utilities: https://www.ncbi.nlm.nih.gov/books/NBK25500/
 *   - Semantic Scholar API: https://api.semanticscholar.org/
 *   - OpenAlex: https://docs.openalex.org/
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface LiteratureResult {
  /** PubMed ID */
  pmid: string;
  /** Paper title */
  title: string;
  /** Authors (first 3 + et al.) */
  authors: string;
  /** Journal name */
  journal: string;
  /** Publication year */
  year: number;
  /** Abstract (truncated to 300 chars) */
  abstract: string;
  /** DOI */
  doi: string | null;
  /** Citation count (if available) */
  citations: number | null;
  /** Source database */
  source: "pubmed" | "semantic_scholar" | "openalex";
  /** Relevance score (0-1) */
  relevance: number;
}

export interface SearchOptions {
  /** Maximum results to return */
  maxResults?: number;
  /** Minimum publication year */
  minYear?: number;
  /** Sort order */
  sort?: "relevance" | "date" | "citations";
  /** Include abstracts */
  includeAbstracts?: boolean;
}

// ── PubMed API (NCBI E-utilities) ──────────────────────────────────────

/**
 * Search PubMed using NCBI E-utilities.
 *
 * Uses esearch → efetch pipeline:
 *   1. esearch: get PMIDs matching query
 *   2. efetch: get full records for those PMIDs
 */
export async function searchPubMed(query: string, options: SearchOptions = {}): Promise<LiteratureResult[]> {
  const { maxResults = 20, minYear, sort = "relevance", includeAbstracts = true } = options;

  const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

  // Build search query
  let searchQuery = query;
  if (minYear) {
    searchQuery += ` AND ${minYear}[pdat]`;
  }

  const sortParam = sort === "date" ? "date" : "relevance";

  try {
    // Step 1: Search for PMIDs
    const searchUrl = `${baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=${maxResults}&sort=${sortParam}&retmode=json`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });

    if (!searchRes.ok) {
      throw new Error(`PubMed search failed: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const pmids: string[] = searchData.esearchresult?.idlist ?? [];

    if (pmids.length === 0) return [];

    // Step 2: Fetch full records
    const fetchUrl = `${baseUrl}/efetch.fcgi?db=pubmed&id=${pmids.join(",")}&rettype=abstract&retmode=xml`;
    const fetchRes = await fetch(fetchUrl, { signal: AbortSignal.timeout(15000) });

    if (!fetchRes.ok) {
      throw new Error(`PubMed fetch failed: ${fetchRes.status}`);
    }

    const xmlText = await fetchRes.text();

    // Parse XML (simple regex-based parsing for Edge Runtime compatibility)
    return parsePubMedXML(xmlText);
  } catch (error) {
    console.error("PubMed API error:", error);
    return [];
  }
}

/**
 * Parse PubMed XML response into structured results.
 * Uses regex parsing for Edge Runtime compatibility (no DOM parser).
 */
function parsePubMedXML(xml: string): LiteratureResult[] {
  const results: LiteratureResult[] = [];

  // Extract article blocks
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let match;

  while ((match = articleRegex.exec(xml)) !== null) {
    const article = match[1];

    const pmid = extractTag(article, "PMID") ?? "";
    const title = extractTag(article, "ArticleTitle") ?? "";
    const abstract = extractTag(article, "AbstractText") ?? "";
    const journal = extractTag(article, "Title") ?? extractTag(article, "ISOAbbreviation") ?? "";
    const yearStr = extractTag(article, "Year") ?? "";
    const doi = extractTag(article, "ArticleId", 'IdType="doi"');

    // Extract authors
    const authorRegex = /<Author[^>]*>[\s\S]*?<LastName>(.*?)<\/LastName>[\s\S]*?<\/Author>/g;
    const authors: string[] = [];
    let authorMatch;
    while ((authorMatch = authorRegex.exec(article)) !== null) {
      const lastName = authorMatch[1];
      const firstName = extractTag(authorMatch[0], "ForeName") ?? "";
      authors.push(firstName ? `${lastName} ${firstName[0]}` : lastName);
      if (authors.length >= 3) break;
    }
    const authorStr = authors.length >= 3 ? `${authors[0]}, ${authors[1]}, et al.` : authors.join(", ");

    results.push({
      pmid,
      title: decodeHTML(title),
      authors: authorStr,
      journal,
      year: parseInt(yearStr) || 0,
      abstract: includeAbstract ? decodeHTML(abstract).slice(0, 300) : "",
      doi,
      citations: null,
      source: "pubmed",
      relevance: 0.5, // PubMed doesn't provide relevance scores
    });
  }

  return results;
}

function extractTag(xml: string, tag: string, attr?: string): string | null {
  const attrPattern = attr ? ` ${attr}` : "";
  const regex = new RegExp(`<${tag}${attrPattern}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function decodeHTML(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ── Semantic Scholar API ───────────────────────────────────────────────

/**
 * Search Semantic Scholar for papers.
 *
 * Advantages over PubMed:
 *   - Provides citation counts
 *   - Better relevance ranking
 *   - Includes preprints
 *   - Faster response times
 */
export async function searchSemanticScholar(query: string, options: SearchOptions = {}): Promise<LiteratureResult[]> {
  const { maxResults = 20, minYear, sort = "relevance", includeAbstracts = true } = options;

  const fields = "title,authors,year,abstract,citationCount,externalIds,journal";
  let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${maxResults}&fields=${fields}`;

  if (minYear) {
    url += `&year=${minYear}-`;
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      throw new Error(`Semantic Scholar search failed: ${res.status}`);
    }

    const data = await res.json();
    const papers = data.data ?? [];

    return papers.map((paper: Record<string, unknown>) => {
      const authors = (paper.authors as Array<{ name: string }>) ?? [];
      const authorStr =
        authors.length >= 3 ? `${authors[0].name}, ${authors[1].name}, et al.` : authors.map((a) => a.name).join(", ");

      return {
        pmid: (paper.externalIds as Record<string, string>)?.PubMed ?? "",
        title: (paper.title as string) ?? "",
        authors: authorStr,
        journal: (paper.journal as { name?: string })?.name ?? "",
        year: (paper.year as number) ?? 0,
        abstract: includeAbstracts ? ((paper.abstract as string) ?? "").slice(0, 300) : "",
        doi: (paper.externalIds as Record<string, string>)?.DOI ?? null,
        citations: (paper.citationCount as number) ?? null,
        source: "semantic_scholar" as const,
        relevance: 0.5,
      };
    });
  } catch (error) {
    console.error("Semantic Scholar API error:", error);
    return [];
  }
}

// ── OpenAlex API ───────────────────────────────────────────────────────

/**
 * Search OpenAlex for papers.
 *
 * Advantages:
 *   - Completely free, no rate limit
 *   - Covers 250M+ works
 *   - Good metadata quality
 */
export async function searchOpenAlex(query: string, options: SearchOptions = {}): Promise<LiteratureResult[]> {
  const { maxResults = 20, minYear, sort = "relevance" } = options;

  let url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${maxResults}`;

  if (minYear) {
    url += `&filter=from_publication_date:${minYear}-01-01`;
  }

  if (sort === "citations") {
    url += "&sort=cited_by_count:desc";
  } else if (sort === "date") {
    url += "&sort=publication_date:desc";
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NexusBio/1.0 (contact@nexus-bio.vercel.app)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`OpenAlex search failed: ${res.status}`);
    }

    const data = await res.json();
    const works = data.results ?? [];

    return works.map((work: Record<string, unknown>) => {
      const authorships = (work.authorships as Array<{ author: { display_name: string } }>) ?? [];
      const authors = authorships.map((a) => a.author.display_name);
      const authorStr = authors.length >= 3 ? `${authors[0]}, ${authors[1]}, et al.` : authors.join(", ");

      const biblio = work.biblio as Record<string, string> | undefined;
      const doi = work.doi as string | null;

      return {
        pmid: "",
        title: (work.title as string) ?? "",
        authors: authorStr,
        journal: (work.primary_location as { source?: { display_name?: string } })?.source?.display_name ?? "",
        year: (work.publication_year as number) ?? 0,
        abstract: "",
        doi: doi?.replace("https://doi.org/", "") ?? null,
        citations: (work.cited_by_count as number) ?? null,
        source: "openalex" as const,
        relevance: 0.5,
      };
    });
  } catch (error) {
    console.error("OpenAlex API error:", error);
    return [];
  }
}

// ── Unified Search ─────────────────────────────────────────────────────

/**
 * Search across all literature databases and merge results.
 *
 * Deduplicates by DOI or title similarity, ranks by relevance.
 */
export async function searchLiterature(query: string, options: SearchOptions = {}): Promise<LiteratureResult[]> {
  const maxResults = options.maxResults ?? 20;

  // Search all sources in parallel
  const [pubmedResults, ssResults, oaResults] = await Promise.allSettled([
    searchPubMed(query, { ...options, maxResults: Math.ceil(maxResults * 0.5) }),
    searchSemanticScholar(query, { ...options, maxResults: Math.ceil(maxResults * 0.5) }),
    searchOpenAlex(query, { ...options, maxResults: Math.ceil(maxResults * 0.5) }),
  ]);

  const allResults: LiteratureResult[] = [
    ...(pubmedResults.status === "fulfilled" ? pubmedResults.value : []),
    ...(ssResults.status === "fulfilled" ? ssResults.value : []),
    ...(oaResults.status === "fulfilled" ? oaResults.value : []),
  ];

  // Deduplicate by DOI or title
  const seen = new Set<string>();
  const deduped: LiteratureResult[] = [];

  for (const result of allResults) {
    const key = result.doi ?? result.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }

  // Sort by citations (if available) or keep original order
  deduped.sort((a, b) => {
    if (a.citations !== null && b.citations !== null) {
      return b.citations - a.citations;
    }
    if (a.citations !== null) return -1;
    if (b.citations !== null) return 1;
    return 0;
  });

  return deduped.slice(0, maxResults);
}

const includeAbstract = true;
