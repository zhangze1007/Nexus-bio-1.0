'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Search,
  Send,
} from 'lucide-react';
import EmptyState from './ide/shared/EmptyState';
import Pagination from './ide/shared/Pagination';

import { T } from './ide/tokens';
import { useWorkbenchStore } from '../store/workbenchStore';

const SANS = T.SANS;
const MONO = T.MONO;

interface Article {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  year: string;
  doi: string;
  url: string;
  source: string;
  citationCount?: number;
  openAccess?: boolean;
  isPreprint?: boolean;
  pathway?: string;
}

type SortMode = 'citations' | 'year' | 'title';
type SourceStatus = 'idle' | 'loading' | 'ready' | 'error';
const SOURCE_TIMEOUT_MS = 8000;
const SOURCE_RESULT_LIMIT = 5;

const RESEARCH_PALETTE = {
  page: 'radial-gradient(circle at top, rgba(105,132,188,0.12) 0%, rgba(105,132,188,0.04) 18%, transparent 38%), #050810',
  surface: 'rgba(9,13,20,0.9)',
  surfaceRaised: 'rgba(13,18,27,0.92)',
  surfaceSoft: 'rgba(255,255,255,0.038)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#F4F7FB',
  textMuted: 'rgba(226,232,240,0.7)',
  textSoft: 'rgba(226,232,240,0.52)',
  textFaint: 'rgba(226,232,240,0.3)',
  active: '#F4F7FB',
  activeSurface: 'rgba(232,238,248,0.12)',
  ready: '#97E1C3',
  readySurface: 'rgba(151,225,195,0.12)',
  warning: '#F1C68A',
  warningSurface: 'rgba(241,198,138,0.12)',
  warningBorder: 'rgba(241,198,138,0.24)',
  shadow: '0 22px 70px rgba(3,8,18,0.34)',
} as const;

interface SourceDefinition {
  key: string;
  label: string;
  fetcher: (query: string) => Promise<Article[]>;
}

const SOURCE_DESCRIPTORS: Record<string, { kind: string; access: string }> = {
  'PubMed': { kind: 'Biomedical index', access: 'Abstracts and metadata' },
  'Europe PMC': { kind: 'Literature aggregator', access: 'OA flags and landing pages' },
  'Semantic Scholar': { kind: 'Literature graph', access: 'Metadata and citation graph' },
  'OpenAlex': { kind: 'Scholarly catalog', access: 'Metadata and OA routing' },
  'bioRxiv': { kind: 'Preprint feed', access: 'Public preprints' },
  'CORE': { kind: 'Repository aggregator', access: 'Open repository content' },
};

async function fetchJsonOrThrow(url: string) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function describeSourceIssue(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'timed out';
  }

  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('429')) return 'rate limited';
  if (message.includes('403')) return 'blocked';
  if (message.includes('404')) return 'not found';
  return 'unavailable';
}

function decodeOpenAlexAbstract(index: Record<string, number[]> | null | undefined) {
  if (!index || typeof index !== 'object') return '';
  const positionedTerms = Object.entries(index)
    .flatMap(([term, positions]) =>
      Array.isArray(positions)
        ? positions.map((position) => [position, term] as const)
        : [],
    )
    .sort((left, right) => left[0] - right[0]);

  return positionedTerms.map(([, term]) => term).join(' ');
}

const SHOWCASE_PAPERS: Article[] = [
  {
    id: 'showcase1',
    title: 'Production of the antimalarial drug precursor artemisinic acid in engineered yeast',
    authors: ['Ro D.K.', 'Paradise E.M.', 'Ouellet M.', 'Keasling J.D.'],
    journal: 'Nature',
    year: '2006',
    abstract:
      'We engineered Saccharomyces cerevisiae to produce high titres of artemisinic acid. The engineered yeast expresses amorphadiene synthase and a novel plant cytochrome P450, CYP71AV1, along with its cognate cytochrome P450 reductase to catalyze three oxidation steps to artemisinic acid. This work established the foundation for industrial-scale production of the antimalarial compound.',
    doi: '10.1038/nature04640',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16612385/',
    source: 'Nature',
    citationCount: 2847,
    openAccess: false,
    pathway: 'Acetyl-CoA → FPP → Amorphadiene → Artemisinic Acid',
  },
  {
    id: 'showcase2',
    title: 'Complete biosynthesis of opioids in yeast',
    authors: ['Galanie S.', 'Thodey K.', 'Smolke C.D.'],
    journal: 'Science',
    year: '2015',
    abstract:
      'We engineered Saccharomyces cerevisiae to produce the selected opioid compounds thebaine and hydrocodone starting from glucose. We combined enzyme discovery, enzyme engineering, and pathway and strain optimization to realize the 15-step biochemical pathway in yeast.',
    doi: '10.1126/science.aac9373',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26272907/',
    source: 'Science',
    citationCount: 1203,
    openAccess: false,
    pathway: 'Glucose → Tyrosine → L-DOPA → Reticuline → Thebaine',
  },
  {
    id: 'showcase3',
    title: 'Microbial production of fatty-acid-derived fuels and chemicals from plant biomass',
    authors: ['Steen E.J.', 'Kang Y.', 'Keasling J.D.'],
    journal: 'Nature',
    year: '2010',
    abstract:
      'We engineered Escherichia coli to produce structurally tailored fatty esters, fatty alcohols, and waxes directly from simple sugars. The key was to engineer the cells to overproduce fatty acids and to express enzymes that convert the fatty acids to the desired products.',
    doi: '10.1038/nature08721',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20057858/',
    source: 'Nature',
    citationCount: 1876,
    openAccess: false,
    pathway: 'Glucose → Acetyl-CoA → Fatty Acids → Biodiesel',
  },
];

function extractKeywords(title: string, abstract: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'its', 'it', 'we', 'our', 'their', 'they',
    'which', 'who', 'what', 'when', 'where', 'how', 'as', 'than', 'more', 'also', 'been',
    'such', 'both', 'each', 'during', 'after', 'before', 'between', 'into', 'through',
    'however', 'therefore', 'thus', 'furthermore', 'although', 'since', 'while',
    'using', 'used', 'use', 'show', 'shows', 'showed', 'study', 'studies', 'found',
    'result', 'results', 'analysis', 'data', 'based', 'two', 'three', 'new', 'high',
    'low', 'significant', 'significantly', 'associated', 'compared', 'total',
  ]);

  const words = abstract.split(/\s+/);
  const candidates = new Set<string>();

  title.split(/\s+/).forEach((word) => {
    const clean = word.replace(/[^a-zA-Z0-9\-]/g, '');
    if (clean.length > 3 && !stopWords.has(clean.toLowerCase())) candidates.add(clean);
  });

  const acronyms: string[] = abstract.match(/\b[A-Z][A-Z0-9]{1,9}\b/g) || [];
  acronyms.forEach((acronym) => {
    if (acronym.length >= 2) candidates.add(acronym);
  });

  const frequency: Record<string, number> = {};
  words.forEach((word) => {
    const clean = word.replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
    if (clean.length > 4 && !stopWords.has(clean)) {
      frequency[clean] = (frequency[clean] || 0) + 1;
    }
  });

  Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([word]) => candidates.add(word));

  const hyphenated = abstract.match(/\b[a-zA-Z]+-[a-zA-Z]+(?:-[a-zA-Z]+)?\b/g) || [];
  hyphenated.slice(0, 8).forEach((word) => {
    if (word.length > 5) candidates.add(word);
  });

  return candidates;
}

function highlightKeywords(text: string, keywords: Set<string>) {
  if (!text || keywords.size === 0) return text;

  const escaped = Array.from(keywords)
    .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter((keyword) => keyword.length > 2)
    .join('|');

  if (!escaped) return text;

  try {
    const pattern = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(pattern);

    return parts.map((part, index) => (
      index % 2 === 1 ? (
        <mark
          key={`${part}-${index}`}
          style={{
            background: 'rgba(255,255,255,0.04)',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '0 3px',
            fontWeight: 500,
          }}
        >
          {part}
        </mark>
      ) : part
    ));
  } catch {
    return text;
  }
}

function mergeUniqueArticles(existing: Article[], incoming: Article[]) {
  const seen = new Set(
    existing.map((article) =>
      `${article.doi || article.id || article.title}`.toLowerCase(),
    ),
  );

  const merged = [...existing];
  incoming.forEach((article) => {
    const key = `${article.doi || article.id || article.title}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(article);
  });

  return merged;
}

async function fetchPubMed(query: string): Promise<Article[]> {
  const searchData = await fetchJsonOrThrow(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}+AND+(synthetic+biology+OR+metabolic+engineering+OR+fermentation)&retmax=${SOURCE_RESULT_LIMIT}&sort=relevance&retmode=json`);
  const ids: string[] = searchData.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const summaryData = await fetchJsonOrThrow(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);

  return Promise.all((summaryData.result?.uids || []).map(async (uid: string) => {
    const item = summaryData.result[uid];
    let abstract = '';
    try {
      const response = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${uid}&rettype=abstract&retmode=xml`);
      const xml = new DOMParser().parseFromString(await response.text(), 'text/xml');
      abstract = Array.from(xml.querySelectorAll('AbstractText')).map((element) => element.textContent || '').join(' ');
    } catch {}

    return {
      id: `pm-${uid}`,
      title: item.title || '',
      abstract,
      authors: item.authors?.slice(0, 3).map((author: { name: string }) => author.name) || [],
      journal: item.source || '',
      year: item.pubdate?.split(' ')[0] || '',
      doi: item.articleids?.find((article: { idtype: string; value: string }) => article.idtype === 'doi')?.value || '',
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
      source: 'PubMed',
    };
  }));
}

async function fetchEuropePMC(query: string): Promise<Article[]> {
  const data = await fetchJsonOrThrow(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${SOURCE_RESULT_LIMIT}`);
  return (data.resultList?.result || []).map((item: any) => ({
    id: `epmc-${item.id}`,
    title: item.title || '',
    abstract: item.abstractText || '',
    authors: item.authorString ? item.authorString.split(',').slice(0, 3) : [],
    journal: item.journalTitle || '',
    year: item.pubYear || '',
    doi: item.doi || '',
    url: item.doi ? `https://doi.org/${item.doi}` : `https://europepmc.org/article/${item.source}/${item.id}`,
    source: 'Europe PMC',
    citationCount: item.citedByCount,
    openAccess: item.isOpenAccess === 'Y',
  }));
}

async function fetchSemanticScholar(query: string): Promise<Article[]> {
  const data = await fetchJsonOrThrow(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,abstract,authors,year,journal,externalIds,citationCount,isOpenAccess,venue&limit=${SOURCE_RESULT_LIMIT}`);
  return (data.data || []).map((item: any) => ({
    id: `ss-${item.paperId}`,
    title: item.title || '',
    abstract: item.abstract || '',
    authors: item.authors?.slice(0, 3).map((author: any) => author.name) || [],
    journal: item.venue || item.journal?.name || '',
    year: item.year?.toString() || '',
    doi: item.externalIds?.DOI || '',
    url: item.externalIds?.DOI ? `https://doi.org/${item.externalIds.DOI}` : `https://www.semanticscholar.org/paper/${item.paperId}`,
    source: 'Semantic Scholar',
    citationCount: item.citationCount,
    openAccess: item.isOpenAccess,
  }));
}

async function fetchOpenAlex(query: string): Promise<Article[]> {
  const data = await fetchJsonOrThrow(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${SOURCE_RESULT_LIMIT}&mailto=nexusbio@research.com`);
  return (data.results || []).map((item: any) => {
    const doi = item.doi?.replace('https://doi.org/', '') || '';
    return {
      id: `oa-${item.id}`,
      title: item.title || '',
      abstract: decodeOpenAlexAbstract(item.abstract_inverted_index),
      authors: item.authorships?.slice(0, 3).map((author: any) => author.author?.display_name || '') || [],
      journal: item.primary_location?.source?.display_name || '',
      year: item.publication_year?.toString() || '',
      doi,
      url: item.primary_location?.landing_page_url || item.doi || item.id || '',
      source: 'OpenAlex',
      citationCount: item.cited_by_count,
      openAccess: item.open_access?.is_oa,
    };
  });
}

async function fetchBioRxiv(query: string): Promise<Article[]> {
  const data = await fetchJsonOrThrow(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}+AND+SRC:PPR&format=json&pageSize=${SOURCE_RESULT_LIMIT}&sort=FIRST_PDATE:desc`);
  return (data.resultList?.result || []).map((item: any) => ({
    id: `biorxiv-${item.id}`,
    title: item.title || '',
    abstract: item.abstractText || '',
    authors: item.authorString ? item.authorString.split(',').slice(0, 3) : [],
    journal: 'bioRxiv',
    year: item.pubYear || '',
    doi: item.doi || '',
    url: item.doi ? `https://doi.org/${item.doi}` : '',
    source: 'bioRxiv',
    isPreprint: true,
    openAccess: true,
  }));
}

async function fetchCORE(query: string): Promise<Article[]> {
  const data = await fetchJsonOrThrow(`https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=${SOURCE_RESULT_LIMIT}`);
  return (data.results || []).map((item: any) => ({
    id: `core-${item.id}`,
    title: item.title || '',
    abstract: item.abstract || '',
    authors: item.authors?.slice(0, 3).map((author: any) => author.name || '') || [],
    journal: item.journals?.[0]?.title || '',
    year: item.yearPublished?.toString() || '',
    doi: item.doi || '',
    url: item.downloadUrl || '',
    source: 'CORE',
    openAccess: true,
  }));
}

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  { key: 'PubMed', label: 'PubMed', fetcher: fetchPubMed },
  { key: 'Europe PMC', label: 'Europe PMC', fetcher: fetchEuropePMC },
  { key: 'Semantic Scholar', label: 'Semantic Scholar', fetcher: fetchSemanticScholar },
  { key: 'OpenAlex', label: 'OpenAlex', fetcher: fetchOpenAlex },
  { key: 'bioRxiv', label: 'bioRxiv', fetcher: fetchBioRxiv },
  { key: 'CORE', label: 'CORE', fetcher: fetchCORE },
];

interface SemanticSearchProps {
  onAnalyzePaper?: (text: string) => void;
  initialQuery?: string;
}

function suggestToolRoute(article: Article) {
  const text = `${article.title} ${article.abstract} ${article.pathway ?? ''}`.toLowerCase();
  if (text.includes('single-cell') || text.includes('spatial') || text.includes('transcriptom')) {
    return { href: '/tools/scspatial', label: 'Open SCSPATIAL' };
  }
  if (text.includes('cell-free') || text.includes('tx-tl') || text.includes('iviv')) {
    return { href: '/tools/cellfree', label: 'Open Cell-Free Sandbox' };
  }
  if (text.includes('protein') || text.includes('enzyme') || text.includes('catalyst') || text.includes('binding')) {
    return { href: '/tools/catdes', label: 'Open Catalyst Designer' };
  }
  if (text.includes('control') || text.includes('circuit') || text.includes('feedback')) {
    return { href: '/tools/dyncon', label: 'Open Dynamic Control' };
  }
  if (text.includes('thermodynamic') || text.includes('energy') || text.includes('delta g')) {
    return { href: '/tools/cethx', label: 'Open Thermodynamics Engine' };
  }
  return { href: '/tools/pathd', label: 'Open PATHD' };
}

export default function SemanticSearch({ onAnalyzePaper, initialQuery }: SemanticSearchProps) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<Article[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showShowcase, setShowShowcase] = useState(!initialQuery);
  const [sourceFilter, setSourceFilter] = useState<'All' | string>('All');
  const [sortMode, setSortMode] = useState<SortMode>('citations');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [sourceState, setSourceState] = useState<Record<string, SourceStatus>>(
    () => Object.fromEntries(SOURCE_DEFINITIONS.map((source) => [source.key, 'idle'])),
  );
  const [sourceIssues, setSourceIssues] = useState<Record<string, string>>({});
  const didAutoSearch = useRef(false);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const upsertEvidence = useWorkbenchStore((s) => s.upsertEvidence);
  const toggleEvidenceSelection = useWorkbenchStore((s) => s.toggleEvidenceSelection);
  const prepareAnalyzeFromEvidence = useWorkbenchStore((s) => s.prepareAnalyzeFromEvidence);

  const evidenceIdByKey = useMemo(() => {
    return new Map(
      evidenceItems.map((item) => [
        `${item.doi || item.url || item.title}`.toLowerCase(),
        item.id,
      ]),
    );
  }, [evidenceItems]);

  const selectedEvidenceItems = useMemo(() => {
    return evidenceItems.filter((item) => selectedEvidenceIds.includes(item.id));
  }, [evidenceItems, selectedEvidenceIds]);

  const selectedEvidenceBySource = useMemo(() => {
    return selectedEvidenceItems.reduce<Record<string, typeof selectedEvidenceItems>>((acc, item) => {
      const key = item.source || item.journal || 'Unlabeled source';
      acc[key] = acc[key] ? [...acc[key], item] : [item];
      return acc;
    }, {});
  }, [selectedEvidenceItems]);

  useEffect(() => {
    if (initialQuery && !didAutoSearch.current) {
      didAutoSearch.current = true;
      runSearch(initialQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const sourceCounts = useMemo(() => {
    return results.reduce<Record<string, number>>((acc, article) => {
      acc[article.source] = (acc[article.source] || 0) + 1;
      return acc;
    }, {});
  }, [results]);

  const filteredResults = useMemo(() => {
    return results
      .filter((article) => sourceFilter === 'All' || article.source === sourceFilter)
      .sort((a, b) => {
        if (sortMode === 'title') return a.title.localeCompare(b.title);
        if (sortMode === 'year') return Number(b.year || 0) - Number(a.year || 0);
        return (b.citationCount || 0) - (a.citationCount || 0);
      });
  }, [results, sortMode, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [pageSize, sourceFilter, sortMode, results]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [page, safePage]);

  const visibleResults = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, pageSize, safePage]);

  const failingSources = useMemo(
    () => Object.entries(sourceState)
      .filter(([, state]) => state === 'error')
      .map(([source]) => ({ source, issue: sourceIssues[source] || 'unavailable' })),
    [sourceIssues, sourceState],
  );

  const completedSources = useMemo(
    () => Object.values(sourceState).filter((state) => state === 'ready' || state === 'error').length,
    [sourceState],
  );

  const successfulSources = useMemo(
    () => Object.values(sourceState).filter((state) => state === 'ready').length,
    [sourceState],
  );

  const openAccessCount = useMemo(
    () => results.filter((article) => article.openAccess).length,
    [results],
  );

  const preprintCount = useMemo(
    () => results.filter((article) => article.isPreprint).length,
    [results],
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setExpandedIds(new Set());
    setHasSearched(false);
    setShowShowcase(true);
    setSourceFilter('All');
    setSortMode('citations');
    setSourceIssues({});
    setSourceState(Object.fromEntries(SOURCE_DEFINITIONS.map((source) => [source.key, 'idle'])));
  }, []);

  const runSearch = useCallback(async (nextQuery: string) => {
    if (!nextQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setResults([]);
    setExpandedIds(new Set());
    setShowShowcase(false);
    setSourceFilter('All');
    setSourceIssues({});
    setSourceState(Object.fromEntries(SOURCE_DEFINITIONS.map((source) => [source.key, 'loading'])));

    await Promise.allSettled(SOURCE_DEFINITIONS.map(async (source) => {
      try {
        const articles = await source.fetcher(nextQuery);
        setResults((prev) => mergeUniqueArticles(prev, articles));
        setSourceState((prev) => ({ ...prev, [source.key]: 'ready' }));
      } catch (error) {
        setSourceState((prev) => ({ ...prev, [source.key]: 'error' }));
        setSourceIssues((prev) => ({ ...prev, [source.key]: describeSourceIssue(error) }));
      }
    }));

    setIsSearching(false);
  }, []);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await runSearch(query);
  };

  const persistArticleEvidence = useCallback((article: Article, options?: { select?: boolean }) => {
    return upsertEvidence(
      {
        sourceKind: 'literature',
        title: article.title,
        abstract: article.abstract,
        authors: article.authors,
        journal: article.journal,
        year: article.year,
        doi: article.doi,
        url: article.url,
        source: article.source,
        query: query.trim() || initialQuery || undefined,
      },
      { select: options?.select ?? true },
    );
  }, [initialQuery, query, upsertEvidence]);

  const handleAnalyze = (article: Article) => {
    if (!onAnalyzePaper) return;
    const evidenceId = persistArticleEvidence(article, { select: true });
    const prepared = prepareAnalyzeFromEvidence([evidenceId]);
    onAnalyzePaper(
      prepared || `Title: ${article.title}\nAuthors: ${article.authors.join(', ')}\nJournal: ${article.journal} (${article.year})\nAbstract: ${article.abstract}`,
    );
  };

  const handleAnalyzeBundle = () => {
    if (!onAnalyzePaper || selectedEvidenceIds.length === 0) return;
    const prepared = prepareAnalyzeFromEvidence();
    if (!prepared) return;
    onAnalyzePaper(prepared);
  };

  const saveButtonLabel = (article: Article) => {
    const evidenceId = evidenceIdByKey.get(`${article.doi || article.url || article.title}`.toLowerCase());
    if (!evidenceId) return 'Save evidence';
    return selectedEvidenceIds.includes(evidenceId) ? 'Selected' : 'Saved';
  };

  const handleSaveToggle = (article: Article) => {
    const key = `${article.doi || article.url || article.title}`.toLowerCase();
    const evidenceId = evidenceIdByKey.get(key);
    if (evidenceId) {
      toggleEvidenceSelection(evidenceId);
      return;
    }
    persistArticleEvidence(article, { select: true });
  };

  return (
    <section
      className="px-4 py-24"
      id="search"
      style={{
        background: RESEARCH_PALETTE.page,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div style={{ marginBottom: '28px' }}>
          <p style={{ color: RESEARCH_PALETTE.textFaint, fontSize: '11px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
            Literature workbench
          </p>
          <h2 style={{ color: RESEARCH_PALETTE.text, fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '10px', lineHeight: 1.08 }}>
            Database Research
          </h2>
          <p style={{ color: RESEARCH_PALETTE.textMuted, fontSize: '15px', lineHeight: 1.7, maxWidth: '74ch', margin: 0 }}>
            Search across PubMed, Europe PMC, Semantic Scholar, OpenAlex, bioRxiv, and CORE from one literature desk. Nexus-Bio prioritizes open-access and publicly reachable research where available, surfaces live metadata from connected sources, and flags source gaps honestly when a service is limited or unavailable.
          </p>
        </div>

        <div
          style={{
            marginBottom: '22px',
            borderRadius: '20px',
            border: `1px solid ${RESEARCH_PALETTE.border}`,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)',
            padding: '14px 16px',
            boxShadow: RESEARCH_PALETTE.shadow,
          }}
        >
          <p style={{ margin: '0 0 12px', color: RESEARCH_PALETTE.textSoft, fontSize: '13px', lineHeight: 1.7, maxWidth: '76ch' }}>
            Connected sources include biomedical indexes, literature aggregators, preprints, and repository-fed open-access records. Curated landmark papers remain separate from the live query stream so background reading never gets mixed into current search results.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SOURCE_DEFINITIONS.map((source) => (
              <div
                key={source.key}
                style={{
                  minHeight: '32px',
                  padding: '0 10px',
                  borderRadius: '999px',
                  border: `1px solid ${RESEARCH_PALETTE.border}`,
                  background: 'rgba(255,255,255,0.035)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: RESEARCH_PALETTE.textSoft,
                  fontSize: '11px',
                  lineHeight: 1,
                }}
              >
                <span style={{ color: RESEARCH_PALETTE.textMuted, fontWeight: 600 }}>{source.label}</span>
                <span style={{ color: RESEARCH_PALETTE.textFaint }}>
                  {SOURCE_DESCRIPTORS[source.key]?.kind}
                </span>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          style={{
            position: 'relative',
            marginBottom: '26px',
            borderRadius: '20px',
            border: `1px solid ${isSearchFocused ? 'rgba(255,255,255,0.2)' : RESEARCH_PALETTE.border}`,
            background: isSearchFocused
              ? 'rgba(12,17,26,0.96)'
              : RESEARCH_PALETTE.surface,
            padding: '6px',
            boxShadow: isSearchFocused
              ? '0 0 0 3px rgba(255,255,255,0.035), 0 20px 52px rgba(4,10,16,0.34)'
              : '0 16px 40px rgba(4,10,16,0.24)',
            transition: 'border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease',
          }}
        >
          <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Search size={16} style={{ color: isSearchFocused ? RESEARCH_PALETTE.textMuted : RESEARCH_PALETTE.textFaint, transition: 'color 0.2s ease' }} />
          </div>

          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search artemisinin biosynthesis, lactic acid fermentation, CRISPR metabolic engineering..."
            aria-label="Search across scientific databases"
            style={{
              width: '100%',
              minHeight: '48px',
              padding: '0 140px 0 44px',
              background: 'transparent',
              border: 'none',
              color: RESEARCH_PALETTE.text,
              fontSize: '14px',
              outline: 'none',
              letterSpacing: '-0.01em',
              fontFamily: 'inherit',
            }}
          />

          <button
            type="submit"
            disabled={isSearching}
            style={{
              position: 'absolute',
              right: '6px',
              top: '6px',
              bottom: '6px',
              minWidth: '108px',
              padding: '0 16px',
              background: isSearching ? 'rgba(255,255,255,0.08)' : RESEARCH_PALETTE.active,
              color: isSearching ? RESEARCH_PALETTE.textFaint : '#050810',
              border: 'none',
              borderRadius: '14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isSearching ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              letterSpacing: '-0.01em',
              fontFamily: 'inherit',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
              boxShadow: isSearching ? 'none' : '0 10px 28px rgba(244,247,251,0.14)',
            }}
            className="nb-research-primary-control"
          >
            {isSearching ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
            {isSearching ? 'Searching' : 'Search'}
          </button>
        </form>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }

          .nb-research-control,
          .nb-research-primary-control {
            transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          }

          .nb-research-control:hover:not(:disabled),
          .nb-research-control:focus-visible:not(:disabled) {
            border-color: rgba(255,255,255,0.18) !important;
            background: rgba(255,255,255,0.09) !important;
            color: #ffffff !important;
            box-shadow: 0 0 0 3px rgba(255,255,255,0.03) !important;
            outline: none;
          }

          .nb-research-primary-control:hover:not(:disabled),
          .nb-research-primary-control:focus-visible:not(:disabled) {
            background: #ffffff !important;
            color: #050810 !important;
            transform: translateY(-1px);
            box-shadow: 0 14px 32px rgba(244,247,251,0.18) !important;
            outline: none;
          }

          .nb-research-select {
            transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
          }

          .nb-research-select:hover,
          .nb-research-select:focus-visible {
            border-color: rgba(255,255,255,0.18) !important;
            background: rgba(255,255,255,0.08) !important;
            color: #ffffff !important;
            outline: none;
            box-shadow: 0 0 0 3px rgba(255,255,255,0.03) !important;
          }
        `}</style>

        {(evidenceItems.length > 0 || selectedEvidenceIds.length > 0) && (
          <div
            style={{
              marginBottom: '28px',
              borderRadius: '22px',
              border: `1px solid ${RESEARCH_PALETTE.border}`,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))',
              padding: '16px',
              display: 'grid',
              gap: '14px',
              boxShadow: RESEARCH_PALETTE.shadow,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
                  Evidence bundle
                </p>
                <p style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
                  {selectedEvidenceIds.length} selected · {evidenceItems.length} saved
                </p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.7, margin: 0, maxWidth: '72ch' }}>
                  Save the papers that define your target project, then send the selected bundle to Analyze as a traceable evidence package.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAnalyzeBundle}
                disabled={!onAnalyzePaper || selectedEvidenceIds.length === 0}
                className="nb-research-primary-control"
                style={{
                  minHeight: '38px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  border: `1px solid ${RESEARCH_PALETTE.border}`,
                  background: selectedEvidenceIds.length > 0 ? RESEARCH_PALETTE.active : 'rgba(255,255,255,0.05)',
                  color: selectedEvidenceIds.length > 0 ? '#050810' : RESEARCH_PALETTE.textFaint,
                  cursor: selectedEvidenceIds.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: SANS,
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <Send size={14} />
                Send Selected To Analyze
              </button>
            </div>

            {selectedEvidenceItems.length > 0 && (
              <div style={{ display: 'grid', gap: '10px' }}>
                {Object.entries(selectedEvidenceBySource).map(([source, items]) => (
                  <div
                    key={source}
                    style={{
                      borderRadius: '18px',
                      border: '1px solid rgba(255,255,255,0.07)',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '12px 14px',
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '10px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                      {source}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleEvidenceSelection(item.id)}
                          className="nb-research-control"
                          style={{
                            minHeight: '30px',
                            padding: '0 10px',
                            borderRadius: '999px',
                            border: `1px solid ${RESEARCH_PALETTE.border}`,
                            background: 'rgba(255,255,255,0.04)',
                            color: RESEARCH_PALETTE.textMuted,
                            cursor: 'pointer',
                            fontFamily: SANS,
                            fontSize: '11px',
                            maxWidth: '100%',
                          }}
                          title="Toggle evidence selection"
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showShowcase && (
          <div style={{ marginBottom: '28px' }}>
            <p style={{ color: RESEARCH_PALETTE.textFaint, fontSize: '10px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Curated background reading
            </p>
            <p style={{ margin: '0 0 14px', color: RESEARCH_PALETTE.textSoft, fontSize: '13px', lineHeight: 1.7, maxWidth: '68ch' }}>
              These landmark papers are curated reference points for the platform and remain separate from live query results.
            </p>
            <div style={{ display: 'grid', gap: '10px' }}>
              {SHOWCASE_PAPERS.map((paper) => {
                const isExpanded = expandedIds.has(paper.id);
                return (
                    <article
                    key={paper.id}
                    style={{
                      borderRadius: '18px',
                      border: `1px solid ${RESEARCH_PALETTE.border}`,
                      background: RESEARCH_PALETTE.surface,
                      padding: '18px 20px',
                    }}
                  >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: MONO, margin: '0 0 8px' }}>
                          {paper.source} · {paper.year}
                          {paper.citationCount ? ` · ${paper.citationCount.toLocaleString()} citations` : ''}
                        </p>
                        <p style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600, lineHeight: 1.45, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                          {paper.title}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', margin: 0 }}>
                          {paper.authors.join(', ')} et al.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                          <a
                            href={suggestToolRoute(paper).href}
                            className="nb-research-control"
                            style={{
                              minHeight: '30px',
                              padding: '0 10px',
                              borderRadius: '999px',
                              border: `1px solid ${RESEARCH_PALETTE.border}`,
                              background: RESEARCH_PALETTE.activeSurface,
                              color: RESEARCH_PALETTE.textMuted,
                              display: 'inline-flex',
                              alignItems: 'center',
                              textDecoration: 'none',
                              fontFamily: SANS,
                              fontSize: '11px',
                            }}
                          >
                            {suggestToolRoute(paper).label}
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleExpand(paper.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Collapse ${paper.title}` : `Expand ${paper.title}`}
                        className="nb-research-control"
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '999px',
                          border: `1px solid ${RESEARCH_PALETTE.border}`,
                          background: 'rgba(255,255,255,0.03)',
                          color: RESEARCH_PALETTE.textSoft,
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.75, margin: '0 0 12px' }}>
                          {highlightKeywords(paper.abstract, extractKeywords(paper.title, paper.abstract))}
                        </p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: MONO, margin: 0 }}>
                              {paper.pathway}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => handleSaveToggle(paper)}
                                className="nb-research-control"
                                style={{
                                  minHeight: '34px',
                                  padding: '0 10px',
                                  borderRadius: '999px',
                                  border: `1px solid ${RESEARCH_PALETTE.border}`,
                                  background: 'rgba(255,255,255,0.03)',
                                  color: saveButtonLabel(paper) === 'Selected' ? '#ffffff' : 'rgba(255,255,255,0.55)',
                                  cursor: 'pointer',
                                  fontFamily: SANS,
                                  fontSize: '11px',
                                }}
                              >
                                {saveButtonLabel(paper)}
                              </button>
                              <a
                                href={paper.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="nb-research-control"
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '999px',
                                border: `1px solid ${RESEARCH_PALETTE.border}`,
                                background: 'rgba(255,255,255,0.03)',
                                color: RESEARCH_PALETTE.textSoft,
                                display: 'grid',
                                placeItems: 'center',
                              }}
                              >
                                <ExternalLink size={14} />
                              </a>
                              {onAnalyzePaper && paper.abstract && (
                              <button
                                type="button"
                                onClick={() => handleAnalyze(paper)}
                                aria-label={`Send ${paper.title} abstract to analyzer`}
                                title="Send abstract to analyzer"
                                className="nb-research-control"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '34px',
                                    height: '34px',
                                    background: 'rgba(255,255,255,0.04)',
                                    color: RESEARCH_PALETTE.textSoft,
                                    border: `1px solid ${RESEARCH_PALETTE.border}`,
                                    borderRadius: '999px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Send size={15} strokeWidth={2} />
                                </button>
                              )}
                            </div>
                          </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {(hasSearched || isSearching) && (
          <div
            style={{
              borderRadius: '22px',
              border: `1px solid ${RESEARCH_PALETTE.border}`,
              background: RESEARCH_PALETTE.surface,
              overflow: 'hidden',
              boxShadow: RESEARCH_PALETTE.shadow,
            }}
          >
            <div
              style={{
                display: 'grid',
                gap: '14px',
                gridTemplateColumns: 'minmax(0, 1fr)',
                padding: '16px',
                borderBottom: `1px solid ${RESEARCH_PALETTE.border}`,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gap: '10px',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                }}
              >
                {[
                  { label: 'Connected sources', value: `${SOURCE_DEFINITIONS.length}`, detail: 'Live public services' },
                  { label: 'Successful responses', value: `${successfulSources}/${SOURCE_DEFINITIONS.length}`, detail: 'Returned this query' },
                  { label: 'Unique papers', value: `${results.length}`, detail: 'Deduplicated stream' },
                  { label: 'Accessible flags', value: `${openAccessCount} OA · ${preprintCount} preprint`, detail: 'As flagged by sources' },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      borderRadius: '16px',
                      border: `1px solid ${RESEARCH_PALETTE.border}`,
                      background: 'rgba(255,255,255,0.035)',
                      padding: '12px 14px',
                      display: 'grid',
                      gap: '4px',
                    }}
                  >
                    <p style={{ margin: 0, fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: RESEARCH_PALETTE.textFaint }}>
                      {item.label}
                    </p>
                    <p style={{ margin: 0, fontFamily: SANS, fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em', color: RESEARCH_PALETTE.text }}>
                      {item.value}
                    </p>
                    <p style={{ margin: 0, fontFamily: SANS, fontSize: '12px', color: RESEARCH_PALETTE.textSoft }}>
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', color: RESEARCH_PALETTE.textFaint }}>
                    Search state
                  </p>
                  <p style={{ margin: 0, fontFamily: SANS, fontSize: '14px', color: RESEARCH_PALETTE.textMuted }}>
                    {filteredResults.length} unique result{filteredResults.length === 1 ? '' : 's'}
                    {sourceFilter !== 'All' ? ` from ${sourceFilter}` : ''}
                    {isSearching ? ` · ${completedSources}/${SOURCE_DEFINITIONS.length} sources settled` : ''}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: MONO, fontSize: '10px', color: RESEARCH_PALETTE.textFaint, textTransform: 'uppercase' }}>
                    Source
                    <select
                      className="nb-research-select"
                      aria-label="Filter by source"
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                      style={{
                        minHeight: '36px',
                        borderRadius: '10px',
                        border: `1px solid ${RESEARCH_PALETTE.borderStrong}`,
                        background: 'rgba(255,255,255,0.04)',
                        color: RESEARCH_PALETTE.text,
                        padding: '0 10px',
                        fontFamily: SANS,
                        fontSize: '12px',
                      }}
                    >
                      <option value="All">All sources</option>
                      {SOURCE_DEFINITIONS.map((source) => (
                        <option key={source.key} value={source.key}>
                          {source.label} ({sourceCounts[source.key] || 0})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: MONO, fontSize: '10px', color: RESEARCH_PALETTE.textFaint, textTransform: 'uppercase' }}>
                    Sort
                    <select
                      className="nb-research-select"
                      aria-label="Sort results"
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value as SortMode)}
                      style={{
                        minHeight: '36px',
                        borderRadius: '10px',
                        border: `1px solid ${RESEARCH_PALETTE.borderStrong}`,
                        background: 'rgba(255,255,255,0.04)',
                        color: RESEARCH_PALETTE.text,
                        padding: '0 10px',
                        fontFamily: SANS,
                        fontSize: '12px',
                      }}
                    >
                      <option value="citations">Citations</option>
                      <option value="year">Newest</option>
                      <option value="title">Title</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={clearSearch}
                    className="nb-research-control"
                    style={{
                      minHeight: '36px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: `1px solid ${RESEARCH_PALETTE.borderStrong}`,
                      background: 'rgba(255,255,255,0.035)',
                      color: RESEARCH_PALETTE.textSoft,
                      cursor: 'pointer',
                      fontFamily: SANS,
                      fontSize: '12px',
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {SOURCE_DEFINITIONS.map((source) => {
                  const state = sourceState[source.key];
                  const isActive = sourceFilter === source.key;
                  const color = state === 'error'
                    ? RESEARCH_PALETTE.warning
                    : state === 'ready'
                      ? RESEARCH_PALETTE.ready
                      : state === 'loading'
                        ? RESEARCH_PALETTE.textMuted
                        : RESEARCH_PALETTE.textFaint;
                  const background = state === 'error'
                    ? RESEARCH_PALETTE.warningSurface
                    : state === 'ready'
                      ? RESEARCH_PALETTE.readySurface
                      : 'rgba(255,255,255,0.03)';

                  return (
                    <button
                      key={source.key}
                      type="button"
                      onClick={() => setSourceFilter((prev) => (prev === source.key ? 'All' : source.key))}
                      aria-pressed={isActive}
                      className="nb-research-control"
                      style={{
                        minHeight: '34px',
                        padding: '0 10px',
                        borderRadius: '999px',
                        border: `1px solid ${isActive ? color : RESEARCH_PALETTE.border}`,
                        background: isActive ? background : 'rgba(255,255,255,0.03)',
                        color,
                        cursor: 'pointer',
                        fontFamily: MONO,
                        fontSize: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '999px',
                          background: color,
                          boxShadow: state === 'loading' ? `0 0 0 4px rgba(255,255,255,0.08)` : 'none',
                        }}
                      />
                      {source.label}
                      <span style={{ color: RESEARCH_PALETTE.textSoft }}>{sourceCounts[source.key] || 0}</span>
                    </button>
                  );
                })}
              </div>

              {failingSources.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    borderRadius: '14px',
                    border: `1px solid ${RESEARCH_PALETTE.warningBorder}`,
                    background: RESEARCH_PALETTE.warningSurface,
                    padding: '12px 14px',
                  }}
                >
                  <AlertCircle size={16} style={{ color: RESEARCH_PALETTE.warning, marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: '0 0 4px', fontFamily: SANS, fontSize: '13px', fontWeight: 600, color: RESEARCH_PALETTE.text }}>
                      Partial results
                    </p>
                    <p style={{ margin: 0, fontFamily: SANS, fontSize: '12px', lineHeight: 1.6, color: RESEARCH_PALETTE.textSoft }}>
                      Some connected sources were limited for this query: {failingSources.map(({ source, issue }) => `${source} (${issue})`).join(', ')}. The result stream below reflects the remaining live responses.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {isSearching && results.length === 0 ? (
              <div style={{ minHeight: '280px' }}>
                <EmptyState type="loading" title="Searching literature" message="Querying PubMed, Europe PMC, Semantic Scholar, OpenAlex, bioRxiv, and CORE in parallel." />
              </div>
            ) : filteredResults.length === 0 && hasSearched && !isSearching ? (
              <div style={{ minHeight: '280px' }}>
                <EmptyState title={`No results found for “${query}”`} message="Try a broader pathway, host organism, or engineering term." />
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '10px', padding: '16px' }}>
                  {visibleResults.map((article) => {
                    const isExpanded = expandedIds.has(article.id);

                    return (
                      <article
                        key={article.id}
                        style={{
                          borderRadius: '18px',
                          border: `1px solid ${isExpanded ? RESEARCH_PALETTE.borderStrong : RESEARCH_PALETTE.border}`,
                          background: isExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                          padding: '18px 20px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: MONO, margin: '0 0 8px' }}>
                              {article.source}
                              {article.journal ? ` · ${article.journal}` : ''}
                              {article.year ? ` · ${article.year}` : ''}
                              {article.citationCount ? ` · ${article.citationCount.toLocaleString()} citations` : ''}
                              {article.isPreprint ? ' · Preprint' : ''}
                              {article.openAccess ? ' · Open Access' : ''}
                            </p>
                            <p style={{ color: '#ffffff', fontSize: '15px', fontWeight: 600, lineHeight: 1.55, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                              {article.title}
                            </p>
                            {article.authors.length > 0 && (
                              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', margin: 0 }}>
                                {article.authors.join(', ')}{article.authors.length === 3 ? ' et al.' : ''}
                              </p>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {article.url && (
                              <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="nb-research-control"
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '999px',
                                  border: `1px solid ${RESEARCH_PALETTE.border}`,
                                  background: 'rgba(255,255,255,0.03)',
                                  color: RESEARCH_PALETTE.textSoft,
                                  display: 'grid',
                                  placeItems: 'center',
                                }}
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => toggleExpand(article.id)}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? `Collapse ${article.title}` : `Expand ${article.title}`}
                              className="nb-research-control"
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '999px',
                                border: `1px solid ${RESEARCH_PALETTE.border}`,
                                background: 'rgba(255,255,255,0.03)',
                                color: RESEARCH_PALETTE.textSoft,
                                cursor: 'pointer',
                                display: 'grid',
                                placeItems: 'center',
                              }}
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          </div>
                        </div>

                      {isExpanded && article.abstract && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.8, margin: '0 0 12px' }}>
                            {highlightKeywords(article.abstract, extractKeywords(article.title, article.abstract))}
                          </p>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {article.doi && (
                                <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                                  DOI: {article.doi}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSaveToggle(article)}
                                className="nb-research-control"
                                style={{
                                  minHeight: '30px',
                                  padding: '0 10px',
                                  borderRadius: '999px',
                                  border: `1px solid ${RESEARCH_PALETTE.border}`,
                                  background: 'rgba(255,255,255,0.03)',
                                  color: saveButtonLabel(article) === 'Selected' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  fontFamily: SANS,
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                }}
                              >
                                {saveButtonLabel(article)}
                              </button>
                              <a
                                href={suggestToolRoute(article).href}
                                className="nb-research-control"
                                style={{
                                  minHeight: '30px',
                                  padding: '0 10px',
                                  borderRadius: '999px',
                                  border: `1px solid ${RESEARCH_PALETTE.border}`,
                                  background: RESEARCH_PALETTE.activeSurface,
                                  color: RESEARCH_PALETTE.textMuted,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  textDecoration: 'none',
                                  fontFamily: SANS,
                                  fontSize: '11px',
                                }}
                              >
                                {suggestToolRoute(article).label}
                              </a>
                            </div>
                            {onAnalyzePaper && article.abstract && (
                              <button
                                type="button"
                                onClick={() => handleAnalyze(article)}
                                aria-label={`Send ${article.title} abstract to analyzer`}
                                title="Send abstract to analyzer"
                                className="nb-research-control"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '34px',
                                  height: '34px',
                                  background: 'rgba(255,255,255,0.04)',
                                  color: RESEARCH_PALETTE.textSoft,
                                  border: `1px solid ${RESEARCH_PALETTE.border}`,
                                  borderRadius: '999px',
                                  cursor: 'pointer',
                                }}
                              >
                                <Send size={15} strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      </article>
                    );
                  })}
                </div>

                <Pagination
                  totalItems={filteredResults.length}
                  currentPage={safePage}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[4, 6, 8, 12]}
                  itemLabel="results"
                />
              </>
            )}
          </div>
        )}

        {!hasSearched && !showShowcase && (
          <div style={{ marginTop: '24px' }}>
            <EmptyState title="Start with a paper, pathway, or host organism" message="Use the search bar to populate the literature workbench." />
          </div>
        )}
      </div>
    </section>
  );
}
