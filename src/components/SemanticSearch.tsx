import { useState, useRef } from 'react';
import { Search, ExternalLink, FileText, Sparkles, Loader2, ChevronDown, ChevronUp, Dna, BookOpen, Atom, Globe, FlaskConical, Zap } from 'lucide-react';

const ACCENT = '#6495ED';
const ACCENT_DIM = 'rgba(100,149,237,0.12)';
const ACCENT_BORDER = 'rgba(100,149,237,0.22)';

// ── Database definitions ──
const DATABASES = [
  { id: 'pubmed',    label: 'PubMed',           color: '#4A90D9', icon: '🔬', desc: '35M+ biomedical' },
  { id: 'europepmc', label: 'Europe PMC',        color: '#5BA85A', icon: '🌿', desc: '40M+ life science' },
  { id: 'semantic',  label: 'Semantic Scholar',  color: '#9B59B6', icon: '🧠', desc: '200M+ AI-indexed' },
  { id: 'openalex',  label: 'OpenAlex',          color: '#E67E22', icon: '🌐', desc: '250M+ all disciplines' },
  { id: 'biorxiv',   label: 'bioRxiv / medRxiv', color: '#E74C3C', icon: '⚗️', desc: 'Latest preprints' },
  { id: 'core',      label: 'CORE',              color: '#1ABC9C', icon: '📂', desc: 'Open access full-text' },
];

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
  sourceColor: string;
  isPreprint?: boolean;
  citationCount?: number;
  openAccess?: boolean;
}

const SHOWCASE_PAPERS = [
  {
    id: 'showcase1',
    title: 'Production of the antimalarial drug precursor artemisinic acid in engineered yeast',
    authors: ['Ro D.K.', 'Paradise E.M.', 'Ouellet M.', 'Keasling J.D.'],
    journal: 'Nature', year: '2006',
    abstract: 'We engineered Saccharomyces cerevisiae to produce high titres of artemisinic acid. The engineered yeast expresses amorphadiene synthase and a novel plant cytochrome P450, CYP71AV1, along with its cognate cytochrome P450 reductase to catalyze three oxidation steps to artemisinic acid.',
    doi: '10.1038/nature04640',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16612385/',
    source: 'Nature',
    sourceColor: '#E74C3C',
    citationCount: 2847,
    openAccess: false,
    pathway: 'Acetyl-CoA → FPP → Amorphadiene → Artemisinic Acid',
  },
  {
    id: 'showcase2',
    title: 'Complete biosynthesis of opioids in yeast',
    authors: ['Galanie S.', 'Thodey K.', 'Smolke C.D.'],
    journal: 'Science', year: '2015',
    abstract: 'We engineered Saccharomyces cerevisiae to produce the selected opioid compounds thebaine and hydrocodone starting from glucose. We combined enzyme discovery, enzyme engineering, and pathway and strain optimization.',
    doi: '10.1126/science.aac9373',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26272907/',
    source: 'Science',
    sourceColor: '#4A90D9',
    citationCount: 1203,
    openAccess: false,
    pathway: 'Glucose → Tyrosine → L-DOPA → Reticuline → Thebaine',
  },
  {
    id: 'showcase3',
    title: 'Microbial production of fatty-acid-derived fuels and chemicals from plant biomass',
    authors: ['Steen E.J.', 'Kang Y.', 'Keasling J.D.'],
    journal: 'Nature', year: '2010',
    abstract: 'We have engineered Escherichia coli to produce structurally tailored fatty esters, fatty alcohols, and waxes directly from simple sugars. The engineered cells overproduced fatty acids and expressed enzymes that convert them to the desired products.',
    doi: '10.1038/nature08721',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20057858/',
    source: 'Nature',
    sourceColor: '#E74C3C',
    citationCount: 1876,
    openAccess: false,
    pathway: 'Glucose → Acetyl-CoA → Fatty Acids → Biodiesel',
  },
];

const BIO_KEYWORDS = [
  'metabolic','pathway','enzyme','biosynthesis','fermentation',
  'glucose','pyruvate','acetyl','synthesis','expression',
  'gene','protein','cell','yeast','bacteria','E. coli',
  'CRISPR','flux','yield','titer','production','engineered',
  'substrate','cofactor','TCA','glycolysis','kinase','reductase',
  'synthase','oxidase','P450','cytochrome','plasmid','operon',
];

function highlightKeywords(text: string) {
  const pattern = new RegExp(`\\b(${BIO_KEYWORDS.join('|')})\\b`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    BIO_KEYWORDS.some(k => k.toLowerCase() === part.toLowerCase())
      ? <mark key={i} style={{ background: ACCENT_DIM, color: ACCENT, borderRadius: '3px', padding: '0 2px' }}>{part}</mark>
      : part
  );
}

// ── API fetchers ──
async function fetchPubMed(query: string): Promise<Article[]> {
  const searchRes = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}+AND+(synthetic+biology+OR+metabolic+engineering+OR+fermentation)&retmax=4&sort=relevance&retmode=json`
  );
  const searchData = await searchRes.json();
  const ids: string[] = searchData.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const summaryRes = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
  );
  const summaryData = await summaryRes.json();
  const uids: string[] = summaryData.result?.uids || [];

  return Promise.all(uids.map(async uid => {
    const item = summaryData.result[uid];
    let abstract = '';
    try {
      const r = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${uid}&rettype=abstract&retmode=xml`);
      const xml = new DOMParser().parseFromString(await r.text(), 'text/xml');
      abstract = Array.from(xml.querySelectorAll('AbstractText')).map(e => e.textContent || '').join(' ');
    } catch {}
    return {
      id: `pm-${uid}`, title: item.title || 'No title', abstract,
      authors: item.authors?.slice(0, 3).map((a: any) => a.name) || [],
      journal: item.source || '', year: item.pubdate?.split(' ')[0] || '',
      doi: item.articleids?.find((a: any) => a.idtype === 'doi')?.value || '',
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
      source: 'PubMed', sourceColor: '#4A90D9',
    };
  }));
}

async function fetchEuropePMC(query: string): Promise<Article[]> {
  const res = await fetch(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}+AND+(TITLE_ABS:"metabolic engineering" OR TITLE_ABS:"synthetic biology" OR TITLE_ABS:"fermentation")&format=json&pageSize=3&sort=CITED`
  );
  const data = await res.json();
  return (data.resultList?.result || []).map((item: any) => ({
    id: `epmc-${item.id}`,
    title: item.title || 'No title',
    abstract: item.abstractText || '',
    authors: item.authorString ? item.authorString.split(',').slice(0, 3) : [],
    journal: item.journalTitle || item.bookOrReportDetails?.publisher || '',
    year: item.pubYear || '',
    doi: item.doi || '',
    url: item.doi ? `https://doi.org/${item.doi}` : `https://europepmc.org/article/${item.source}/${item.id}`,
    source: 'Europe PMC', sourceColor: '#5BA85A',
    citationCount: item.citedByCount,
    openAccess: item.isOpenAccess === 'Y',
  }));
}

async function fetchSemanticScholar(query: string): Promise<Article[]> {
  const res = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,abstract,authors,year,journal,externalIds,citationCount,isOpenAccess,venue&limit=4`
  );
  const data = await res.json();
  return (data.data || []).map((item: any) => ({
    id: `ss-${item.paperId}`,
    title: item.title || 'No title',
    abstract: item.abstract || '',
    authors: item.authors?.slice(0, 3).map((a: any) => a.name) || [],
    journal: item.venue || item.journal?.name || '',
    year: item.year?.toString() || '',
    doi: item.externalIds?.DOI || '',
    url: item.externalIds?.DOI ? `https://doi.org/${item.externalIds.DOI}` : `https://www.semanticscholar.org/paper/${item.paperId}`,
    source: 'Semantic Scholar', sourceColor: '#9B59B6',
    citationCount: item.citationCount,
    openAccess: item.isOpenAccess,
  }));
}

async function fetchOpenAlex(query: string): Promise<Article[]> {
  const res = await fetch(
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=concepts.display_name:Biology|Biochemistry|Biotechnology&per-page=3&sort=cited_by_count:desc&mailto=nexusbio@research.com`
  );
  const data = await res.json();
  return (data.results || []).map((item: any) => {
    const doi = item.doi?.replace('https://doi.org/', '') || '';
    return {
      id: `oa-${item.id}`,
      title: item.title || 'No title',
      abstract: item.abstract || '',
      authors: item.authorships?.slice(0, 3).map((a: any) => a.author?.display_name || '') || [],
      journal: item.primary_location?.source?.display_name || '',
      year: item.publication_year?.toString() || '',
      doi,
      url: item.doi || item.primary_location?.landing_page_url || '',
      source: 'OpenAlex', sourceColor: '#E67E22',
      citationCount: item.cited_by_count,
      openAccess: item.open_access?.is_oa,
    };
  });
}

async function fetchBioRxiv(query: string): Promise<Article[]> {
  // bioRxiv API endpoint
  const res = await fetch(
    `https://api.biorxiv.org/details/biorxiv/2020-01-01/${new Date().toISOString().split('T')[0]}/0/json`
  );
  // bioRxiv search is limited — use their search endpoint via CORS-friendly way
  // Fallback: use Europe PMC which indexes bioRxiv
  const epmc = await fetch(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}+AND+SRC:PPR&format=json&pageSize=3&sort=FIRST_PDATE:desc`
  );
  const data = await epmc.json();
  return (data.resultList?.result || []).map((item: any) => ({
    id: `biorxiv-${item.id}`,
    title: item.title || 'No title',
    abstract: item.abstractText || '',
    authors: item.authorString ? item.authorString.split(',').slice(0, 3) : [],
    journal: 'bioRxiv / medRxiv',
    year: item.pubYear || '',
    doi: item.doi || '',
    url: item.doi ? `https://doi.org/${item.doi}` : `https://www.biorxiv.org/search/${encodeURIComponent(query)}`,
    source: 'bioRxiv', sourceColor: '#E74C3C',
    isPreprint: true,
    openAccess: true,
  }));
}

async function fetchCORE(query: string): Promise<Article[]> {
  // CORE free tier — no key needed for basic search
  const res = await fetch(
    `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=3`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  const data = await res.json();
  return (data.results || []).map((item: any) => ({
    id: `core-${item.id}`,
    title: item.title || 'No title',
    abstract: item.abstract || '',
    authors: item.authors?.slice(0, 3).map((a: any) => a.name || '') || [],
    journal: item.journals?.[0]?.title || item.publisher || '',
    year: item.yearPublished?.toString() || '',
    doi: item.doi || '',
    url: item.downloadUrl || item.sourceFulltextUrls?.[0] || '',
    source: 'CORE', sourceColor: '#1ABC9C',
    openAccess: true,
  }));
}

interface SemanticSearchProps {
  onAnalyzePaper?: (text: string) => void;
}

export default function SemanticSearch({ onAnalyzePaper }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showShowcase, setShowShowcase] = useState(true);
  const [activeDBs, setActiveDBs] = useState<Set<string>>(new Set(DATABASES.map(d => d.id)));
  const [dbStatus, setDbStatus] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({});
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleDB = (id: string) => {
    setActiveDBs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || activeDBs.size === 0) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    setResults([]);
    setShowShowcase(false);
    setSourceFilter(null);

    const initialStatus: Record<string, 'loading' | 'idle'> = {};
    DATABASES.forEach(db => { initialStatus[db.id] = activeDBs.has(db.id) ? 'loading' : 'idle'; });
    setDbStatus(initialStatus);

    const fetchers: Record<string, (q: string) => Promise<Article[]>> = {
      pubmed: fetchPubMed,
      europepmc: fetchEuropePMC,
      semantic: fetchSemanticScholar,
      openalex: fetchOpenAlex,
      biorxiv: fetchBioRxiv,
      core: fetchCORE,
    };

    // Fetch all selected databases in parallel, stream results as they arrive
    const promises = Array.from(activeDBs).map(async dbId => {
      try {
        const articles = await fetchers[dbId](query);
        setResults(prev => {
          const existing = new Set(prev.map(a => a.title.toLowerCase().slice(0, 50)));
          const fresh = articles.filter(a => !existing.has(a.title.toLowerCase().slice(0, 50)));
          return [...prev, ...fresh];
        });
        setDbStatus(prev => ({ ...prev, [dbId]: 'done' }));
      } catch {
        setDbStatus(prev => ({ ...prev, [dbId]: 'error' }));
      }
    });

    await Promise.allSettled(promises);
    setIsSearching(false);
  };

  const handleAnalyze = (article: Article) => {
    if (onAnalyzePaper) {
      const text = `Title: ${article.title}\nAuthors: ${article.authors.join(', ')}\nJournal: ${article.journal} (${article.year})\nAbstract: ${article.abstract}`;
      onAnalyzePaper(text);
      document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const filteredResults = sourceFilter ? results.filter(r => r.source === sourceFilter) : results;
  const sourceCounts = results.reduce((acc, r) => { acc[r.source] = (acc[r.source] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <section className="px-4 py-24" id="search" style={{ background: '#0a0a0a' }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            03 · Literature
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
            Multi-Database Search
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>
            Simultaneously searches{' '}
            <span style={{ color: ACCENT }}>6 academic databases</span>
            {' '}· 500M+ papers · Nature · Science · Cell · bioRxiv
          </p>
        </div>

        {/* Database toggles */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {DATABASES.map(db => {
            const isActive = activeDBs.has(db.id);
            const status = dbStatus[db.id];
            return (
              <button key={db.id}
                onClick={() => toggleDB(db.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                  background: isActive ? `${db.color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? `${db.color}40` : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: '12px' }}>{db.icon}</span>
                <span style={{ color: isActive ? db.color : 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>{db.label}</span>
                {status === 'loading' && <Loader2 size={10} style={{ color: db.color, animation: 'spin 1s linear infinite' }} />}
                {status === 'done' && sourceCounts[db.label] && (
                  <span style={{ background: `${db.color}30`, color: db.color, fontSize: '9px', fontFamily: 'monospace', padding: '1px 5px', borderRadius: '10px' }}>
                    {sourceCounts[db.label]}
                  </span>
                )}
                {status === 'error' && <span style={{ color: '#e74c3c', fontSize: '9px' }}>✗</span>}
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px' }}>{db.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="relative mb-8">
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Search size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search across Nature, Science, PubMed, bioRxiv... e.g. 'artemisinin biosynthesis yeast'"
            style={{ width: '100%', padding: '14px 140px 14px 42px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', color: '#ffffff', fontSize: '14px', outline: 'none' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
          <button type="submit" disabled={isSearching || activeDBs.size === 0}
            style={{ position: 'absolute', right: '6px', top: '6px', bottom: '6px', padding: '0 18px', background: isSearching ? 'rgba(255,255,255,0.06)' : '#ffffff', color: isSearching ? 'rgba(255,255,255,0.3)' : '#0a0a0a', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: isSearching ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
            {isSearching ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Source filter pills */}
        {results.length > 0 && Object.keys(sourceCounts).length > 1 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', marginRight: '4px' }}>Filter:</span>
            <button onClick={() => setSourceFilter(null)}
              style={{ padding: '3px 10px', borderRadius: '12px', border: `1px solid ${!sourceFilter ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}`, background: !sourceFilter ? 'rgba(255,255,255,0.08)' : 'transparent', color: !sourceFilter ? '#ffffff' : 'rgba(255,255,255,0.35)', fontSize: '11px', cursor: 'pointer' }}>
              All ({results.length})
            </button>
            {Object.entries(sourceCounts).map(([src, count]) => {
              const db = DATABASES.find(d => d.label === src);
              return (
                <button key={src} onClick={() => setSourceFilter(sourceFilter === src ? null : src)}
                  style={{ padding: '3px 10px', borderRadius: '12px', border: `1px solid ${sourceFilter === src ? (db?.color || ACCENT) + '50' : 'rgba(255,255,255,0.08)'}`, background: sourceFilter === src ? (db?.color || ACCENT) + '15' : 'transparent', color: sourceFilter === src ? (db?.color || ACCENT) : 'rgba(255,255,255,0.35)', fontSize: '11px', cursor: 'pointer', fontFamily: 'monospace' }}>
                  {src} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Showcase */}
        {showShowcase && (
          <div className="mb-10">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <FlaskConical size={15} style={{ color: ACCENT }} />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 600 }}>Landmark Papers · Nature & Science</span>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace' }}>经典论文精选</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {SHOWCASE_PAPERS.map(paper => {
                const isExpanded = expandedIds.has(paper.id);
                return (
                  <div key={paper.id} style={{ borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', transition: 'border-color 0.15s' }}>
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 8px', background: `${paper.sourceColor}18`, border: `1px solid ${paper.sourceColor}40`, borderRadius: '6px', color: paper.sourceColor, fontSize: '10px', fontFamily: 'monospace', fontWeight: 700 }}>
                              {paper.source} · {paper.year}
                            </span>
                            <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'monospace' }}>
                              📊 {paper.citationCount?.toLocaleString()} citations
                            </span>
                          </div>
                          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500, lineHeight: 1.5, margin: '0 0 6px' }}>{paper.title}</p>
                          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace', margin: 0 }}>
                            {paper.authors.join(', ')} et al.
                          </p>
                        </div>
                        <button onClick={() => toggleExpand(paper.id)} style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '4px' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
                            {highlightKeywords(paper.abstract)}
                          </p>
                          <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: ACCENT, fontSize: '10px', fontFamily: 'monospace' }}>Pathway →</span>
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'monospace' }}>{paper.pathway}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button onClick={() => toggleExpand(paper.id)} style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                        {isExpanded ? 'Collapse' : 'Read abstract'}
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                          <ExternalLink size={13} />
                        </a>
                        {onAnalyzePaper && (
                          <button onClick={() => handleAnalyze(paper as any)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, borderRadius: '8px', color: ACCENT, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(100,149,237,0.22)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ACCENT_DIM; }}>
                            <Sparkles size={11} />
                            Generate Pathway
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredResults.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', fontFamily: 'monospace' }}>
                {filteredResults.length} results {sourceFilter ? `from ${sourceFilter}` : `across ${Object.keys(sourceCounts).length} databases`}
                {isSearching && ' · still searching...'}
              </span>
              <button onClick={() => { setResults([]); setHasSearched(false); setShowShowcase(true); setDbStatus({}); }}
                style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                Clear
              </button>
            </div>
          )}

          {filteredResults.map(article => {
            const isExpanded = expandedIds.has(article.id);
            const db = DATABASES.find(d => d.label === article.source);
            return (
              <div key={article.id} style={{ borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', background: `${db?.color || ACCENT}18`, border: `1px solid ${db?.color || ACCENT}35`, borderRadius: '6px', color: db?.color || ACCENT, fontSize: '10px', fontFamily: 'monospace', fontWeight: 700 }}>
                          {db?.icon} {article.source}
                        </span>
                        {article.journal && (
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace' }}>
                            {article.journal}{article.year ? ` · ${article.year}` : ''}
                          </span>
                        )}
                        {article.isPreprint && (
                          <span style={{ padding: '1px 6px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: '4px', color: '#e74c3c', fontSize: '9px', fontFamily: 'monospace' }}>PREPRINT</span>
                        )}
                        {article.openAccess && (
                          <span style={{ padding: '1px 6px', background: 'rgba(26,188,156,0.1)', border: '1px solid rgba(26,188,156,0.25)', borderRadius: '4px', color: '#1abc9c', fontSize: '9px', fontFamily: 'monospace' }}>OPEN ACCESS</span>
                        )}
                        {article.citationCount !== undefined && article.citationCount > 0 && (
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace' }}>
                            📊 {article.citationCount.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 500, lineHeight: 1.5, margin: '0 0 5px' }}>{article.title}</p>
                      {article.authors.length > 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'monospace', margin: 0 }}>
                          {article.authors.join(', ')}{article.authors.length === 3 ? ' et al.' : ''}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {article.url && (
                        <a href={article.url} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'rgba(255,255,255,0.2)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button onClick={() => toggleExpand(article.id)} style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && article.abstract && (
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.7, margin: '0 0 8px' }}>
                        {highlightKeywords(article.abstract)}
                      </p>
                      {article.doi && (
                        <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: 'monospace', margin: 0 }}>
                          DOI: {article.doi}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button onClick={() => toggleExpand(article.id)} style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                    {isExpanded ? 'Collapse' : 'Read abstract'}
                  </button>
                  {onAnalyzePaper && article.abstract && (
                    <button onClick={() => handleAnalyze(article)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, borderRadius: '8px', color: ACCENT, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(100,149,237,0.22)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ACCENT_DIM; }}>
                      <Sparkles size={11} />
                      Generate Pathway
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading skeleton */}
          {isSearching && results.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: '100px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
              <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
            </div>
          )}

          {hasSearched && !isSearching && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' }}>
              <Search size={24} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ fontSize: '13px', margin: 0 }}>No results found for "{query}"</p>
              <p style={{ fontSize: '11px', fontFamily: 'monospace', marginTop: '6px' }}>Try "lactic acid fermentation" or "CRISPR metabolic engineering"</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
