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

const SANS = "'Inter',-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',monospace";

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

interface SourceDefinition {
  key: string;
  label: string;
  fetcher: (query: string) => Promise<Article[]>;
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
            background: 'rgba(153,216,255,0.14)',
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
  const search = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}+AND+(synthetic+biology+OR+metabolic+engineering+OR+fermentation)&retmax=3&sort=relevance&retmode=json`);
  const searchData = await search.json();
  const ids: string[] = searchData.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const summary = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
  const summaryData = await summary.json();

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
  const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}+AND+(TITLE_ABS:"metabolic engineering" OR TITLE_ABS:"synthetic biology")&format=json&pageSize=3&sort=CITED`);
  const data = await response.json();
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
  const response = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,abstract,authors,year,journal,externalIds,citationCount,isOpenAccess,venue&limit=3`);
  const data = await response.json();
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
  const response = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=concepts.display_name:Biology|Biochemistry|Biotechnology&per-page=3&sort=cited_by_count:desc&mailto=nexusbio@research.com`);
  const data = await response.json();
  return (data.results || []).map((item: any) => {
    const doi = item.doi?.replace('https://doi.org/', '') || '';
    return {
      id: `oa-${item.id}`,
      title: item.title || '',
      abstract: item.abstract || '',
      authors: item.authorships?.slice(0, 3).map((author: any) => author.author?.display_name || '') || [],
      journal: item.primary_location?.source?.display_name || '',
      year: item.publication_year?.toString() || '',
      doi,
      url: item.doi || '',
      source: 'OpenAlex',
      citationCount: item.cited_by_count,
      openAccess: item.open_access?.is_oa,
    };
  });
}

async function fetchBioRxiv(query: string): Promise<Article[]> {
  const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}+AND+SRC:PPR&format=json&pageSize=3&sort=FIRST_PDATE:desc`);
  const data = await response.json();
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
  try {
    const response = await fetch(`https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=3`);
    const data = await response.json();
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
  } catch {
    return [];
  }
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

export default function SemanticSearch({ onAnalyzePaper, initialQuery }: SemanticSearchProps) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<Article[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showShowcase, setShowShowcase] = useState(!initialQuery);
  const [sourceFilter, setSourceFilter] = useState<'All' | string>('All');
  const [sortMode, setSortMode] = useState<SortMode>('citations');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [sourceState, setSourceState] = useState<Record<string, SourceStatus>>(
    () => Object.fromEntries(SOURCE_DEFINITIONS.map((source) => [source.key, 'idle'])),
  );
  const didAutoSearch = useRef(false);

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
    () => Object.entries(sourceState).filter(([, state]) => state === 'error').map(([source]) => source),
    [sourceState],
  );

  const completedSources = useMemo(
    () => Object.values(sourceState).filter((state) => state === 'ready' || state === 'error').length,
    [sourceState],
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
    setSourceState(Object.fromEntries(SOURCE_DEFINITIONS.map((source) => [source.key, 'loading'])));

    await Promise.allSettled(SOURCE_DEFINITIONS.map(async (source) => {
      try {
        const articles = await source.fetcher(nextQuery);
        setResults((prev) => mergeUniqueArticles(prev, articles));
        setSourceState((prev) => ({ ...prev, [source.key]: 'ready' }));
      } catch {
        setSourceState((prev) => ({ ...prev, [source.key]: 'error' }));
      }
    }));

    setIsSearching(false);
  }, []);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await runSearch(query);
  };

  const handleAnalyze = (article: Article) => {
    if (!onAnalyzePaper) return;
    onAnalyzePaper(`Title: ${article.title}\nAuthors: ${article.authors.join(', ')}\nJournal: ${article.journal} (${article.year})\nAbstract: ${article.abstract}`);
    document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });
  };

  const SendButton = ({ article }: { article: Article }) => (
    onAnalyzePaper && article.abstract ? (
      <button
        type="button"
        onClick={() => handleAnalyze(article)}
        title="Send abstract to analyzer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '34px',
          height: '34px',
          background: 'rgba(255,255,255,0.04)',
          color: 'rgba(223,232,245,0.72)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '999px',
          cursor: 'pointer',
        }}
      >
        <Send size={15} strokeWidth={2} />
      </button>
    ) : null
  );

  return (
    <section
      className="px-4 py-24"
      id="search"
      style={{
        background: 'linear-gradient(180deg, #071018 0%, #0a121b 100%)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div style={{ marginBottom: '28px' }}>
          <p style={{ color: 'rgba(185,204,228,0.5)', fontSize: '11px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
            Literature workbench
          </p>
          <h2 style={{ color: '#ffffff', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '10px', lineHeight: 1.08 }}>
            Database Research
          </h2>
          <p style={{ color: 'rgba(223,232,245,0.68)', fontSize: '15px', lineHeight: 1.7, maxWidth: '70ch' }}>
            Search six academic sources in parallel, then filter, sort, page, and send the right abstract into the analyzer without losing result position.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          style={{
            position: 'relative',
            marginBottom: '26px',
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(10,16,25,0.92)',
            padding: '8px',
            boxShadow: '0 18px 48px rgba(4,10,16,0.24)',
          }}
        >
          <div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Search size={16} style={{ color: 'rgba(223,232,245,0.35)' }} />
          </div>

          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search artemisinin biosynthesis, lactic acid fermentation, CRISPR metabolic engineering..."
            aria-label="Search across scientific databases"
            style={{
              width: '100%',
              minHeight: '52px',
              padding: '0 152px 0 48px',
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
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
              right: '8px',
              top: '8px',
              bottom: '8px',
              minWidth: '120px',
              padding: '0 18px',
              background: isSearching ? 'rgba(255,255,255,0.08)' : '#f4f7fb',
              color: isSearching ? 'rgba(223,232,245,0.4)' : '#081018',
              border: 'none',
              borderRadius: '16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isSearching ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              letterSpacing: '-0.01em',
              fontFamily: 'inherit',
            }}
          >
            {isSearching ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
            {isSearching ? 'Searching' : 'Search'}
          </button>
        </form>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {showShowcase && (
          <div style={{ marginBottom: '28px' }}>
            <p style={{ color: 'rgba(185,204,228,0.48)', fontSize: '10px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
              Landmark papers
            </p>
            <div style={{ display: 'grid', gap: '10px' }}>
              {SHOWCASE_PAPERS.map((paper) => {
                const isExpanded = expandedIds.has(paper.id);
                return (
                  <article
                    key={paper.id}
                    style={{
                      borderRadius: '18px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(10,16,25,0.92)',
                      padding: '18px 20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'rgba(185,204,228,0.48)', fontSize: '11px', fontFamily: MONO, margin: '0 0 8px' }}>
                          {paper.source} · {paper.year}
                          {paper.citationCount ? ` · ${paper.citationCount.toLocaleString()} citations` : ''}
                        </p>
                        <p style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600, lineHeight: 1.45, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                          {paper.title}
                        </p>
                        <p style={{ color: 'rgba(223,232,245,0.58)', fontSize: '13px', margin: 0 }}>
                          {paper.authors.join(', ')} et al.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleExpand(paper.id)}
                        aria-expanded={isExpanded}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '999px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(255,255,255,0.03)',
                          color: 'rgba(223,232,245,0.7)',
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
                        <p style={{ color: 'rgba(223,232,245,0.7)', fontSize: '13px', lineHeight: 1.75, margin: '0 0 12px' }}>
                          {highlightKeywords(paper.abstract, extractKeywords(paper.title, paper.abstract))}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <p style={{ color: 'rgba(185,204,228,0.48)', fontSize: '11px', fontFamily: MONO, margin: 0 }}>
                            {paper.pathway}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <a
                              href={paper.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '999px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(255,255,255,0.03)',
                                color: 'rgba(223,232,245,0.72)',
                                display: 'grid',
                                placeItems: 'center',
                              }}
                            >
                              <ExternalLink size={14} />
                            </a>
                            <SendButton article={paper} />
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
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(10,16,25,0.94)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gap: '14px',
                gridTemplateColumns: 'minmax(0, 1fr)',
                padding: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(185,204,228,0.48)' }}>
                    Search state
                  </p>
                  <p style={{ margin: 0, fontFamily: SANS, fontSize: '14px', color: 'rgba(223,232,245,0.78)' }}>
                    {filteredResults.length} result{filteredResults.length === 1 ? '' : 's'}
                    {sourceFilter !== 'All' ? ` from ${sourceFilter}` : ''}
                    {isSearching ? ` · ${completedSources}/${SOURCE_DEFINITIONS.length} sources responded` : ''}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: MONO, fontSize: '10px', color: 'rgba(185,204,228,0.48)', textTransform: 'uppercase' }}>
                    Source
                    <select
                      aria-label="Filter by source"
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                      style={{
                        minHeight: '36px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#ffffff',
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

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: MONO, fontSize: '10px', color: 'rgba(185,204,228,0.48)', textTransform: 'uppercase' }}>
                    Sort
                    <select
                      aria-label="Sort results"
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value as SortMode)}
                      style={{
                        minHeight: '36px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#ffffff',
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
                    style={{
                      minHeight: '36px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'rgba(223,232,245,0.72)',
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
                    ? 'rgba(255,140,126,0.9)'
                    : state === 'ready'
                      ? 'rgba(143,239,197,0.9)'
                      : state === 'loading'
                        ? 'rgba(153,216,255,0.9)'
                        : 'rgba(185,204,228,0.48)';

                  return (
                    <button
                      key={source.key}
                      type="button"
                      onClick={() => setSourceFilter((prev) => (prev === source.key ? 'All' : source.key))}
                      aria-pressed={isActive}
                      style={{
                        minHeight: '34px',
                        padding: '0 10px',
                        borderRadius: '999px',
                        border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.08)'}`,
                        background: isActive ? `${color.replace('0.9', '0.14')}` : 'rgba(255,255,255,0.03)',
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
                          boxShadow: state === 'loading' ? `0 0 0 4px ${color.replace('0.9', '0.18')}` : 'none',
                        }}
                      />
                      {source.label}
                      <span style={{ color: 'rgba(223,232,245,0.56)' }}>{sourceCounts[source.key] || 0}</span>
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
                    border: '1px solid rgba(255,140,126,0.22)',
                    background: 'rgba(255,140,126,0.08)',
                    padding: '12px 14px',
                  }}
                >
                  <AlertCircle size={16} style={{ color: 'rgba(255,140,126,0.92)', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: '0 0 4px', fontFamily: SANS, fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                      Partial results
                    </p>
                    <p style={{ margin: 0, fontFamily: SANS, fontSize: '12px', lineHeight: 1.6, color: 'rgba(223,232,245,0.74)' }}>
                      Some sources did not respond for this query: {failingSources.join(', ')}.
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
                          border: `1px solid ${isExpanded ? 'rgba(153,216,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          background: isExpanded ? 'rgba(153,216,255,0.08)' : 'rgba(255,255,255,0.03)',
                          padding: '18px 20px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: 'rgba(185,204,228,0.5)', fontSize: '11px', fontFamily: MONO, margin: '0 0 8px' }}>
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
                              <p style={{ color: 'rgba(223,232,245,0.6)', fontSize: '13px', margin: 0 }}>
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
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '999px',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  background: 'rgba(255,255,255,0.03)',
                                  color: 'rgba(223,232,245,0.72)',
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
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '999px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(255,255,255,0.03)',
                                color: 'rgba(223,232,245,0.72)',
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
                            <p style={{ color: 'rgba(223,232,245,0.74)', fontSize: '13px', lineHeight: 1.8, margin: '0 0 12px' }}>
                              {highlightKeywords(article.abstract, extractKeywords(article.title, article.abstract))}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {article.doi && (
                                  <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(185,204,228,0.5)' }}>
                                    DOI: {article.doi}
                                  </span>
                                )}
                              </div>
                              <SendButton article={article} />
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
