'use client';

import { useState } from 'react';
import { Search, ExternalLink, ChevronDown, ChevronUp, Loader2, Send } from 'lucide-react';

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
}

const SHOWCASE_PAPERS = [
  {
    id: 'showcase1',
    title: 'Production of the antimalarial drug precursor artemisinic acid in engineered yeast',
    authors: ['Ro D.K.', 'Paradise E.M.', 'Ouellet M.', 'Keasling J.D.'],
    journal: 'Nature', year: '2006',
    abstract: 'We engineered Saccharomyces cerevisiae to produce high titres of artemisinic acid. The engineered yeast expresses amorphadiene synthase and a novel plant cytochrome P450, CYP71AV1, along with its cognate cytochrome P450 reductase to catalyze three oxidation steps to artemisinic acid. This work established the foundation for industrial-scale production of the antimalarial compound.',
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
    journal: 'Science', year: '2015',
    abstract: 'We engineered Saccharomyces cerevisiae to produce the selected opioid compounds thebaine and hydrocodone starting from glucose. We combined enzyme discovery, enzyme engineering, and pathway and strain optimization to realize the 15-step biochemical pathway in yeast.',
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
    journal: 'Nature', year: '2010',
    abstract: 'We engineered Escherichia coli to produce structurally tailored fatty esters, fatty alcohols, and waxes directly from simple sugars. The key was to engineer the cells to overproduce fatty acids and to express enzymes that convert the fatty acids to the desired products.',
    doi: '10.1038/nature08721',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20057858/',
    source: 'Nature',
    citationCount: 1876,
    openAccess: false,
    pathway: 'Glucose → Acetyl-CoA → Fatty Acids → Biodiesel',
  },
];

// ── Dynamic keyword extractor — highlights each paper's own key terms ──
function extractKeywords(title: string, abstract: string): Set<string> {
  const combined = `${title} ${abstract}`.toLowerCase();
  const stopWords = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','this','that','these','those','is','are','was','were','be',
    'been','being','have','has','had','do','does','did','will','would','could',
    'should','may','might','can','shall','its','it','we','our','their','they',
    'which','who','what','when','where','how','as','than','more','also','been',
    'such','both','each','during','after','before','between','into','through',
    'however','therefore','thus','furthermore','although','since','while',
    'using','used','use','show','shows','showed','study','studies','found',
    'result','results','analysis','data','based','two','three','new','high',
    'low','significant','significantly','associated','compared','total',
  ]);

  // Extract capitalized phrases and domain-specific terms
  const words = abstract.split(/\s+/);
  const candidates = new Set<string>();

  // 1. Title words (always important)
  title.split(/\s+/).forEach(w => {
    const clean = w.replace(/[^a-zA-Z0-9\-]/g, '');
    if (clean.length > 3 && !stopWords.has(clean.toLowerCase())) {
      candidates.add(clean);
    }
  });

  // 2. Capitalized multi-word terms (acronyms + proper nouns)
  const acronyms: string[] = abstract.match(/\b[A-Z][A-Z0-9]{1,9}\b/g) || [];
  acronyms.forEach(a => { if (a.length >= 2) candidates.add(a); });

  // 3. High-frequency content words in abstract (TF-based)
  const freq: Record<string, number> = {};
  words.forEach(w => {
    const clean = w.replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
    if (clean.length > 4 && !stopWords.has(clean)) {
      freq[clean] = (freq[clean] || 0) + 1;
    }
  });

  // Take top 12 most frequent content words
  Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([w]) => candidates.add(w));

  // 4. Hyphenated scientific terms
  const hyphenated = abstract.match(/\b[a-zA-Z]+-[a-zA-Z]+(?:-[a-zA-Z]+)?\b/g) || [];
  hyphenated.slice(0, 8).forEach(h => {
    if (h.length > 5) candidates.add(h);
  });

  return candidates;
}

function highlightKeywords(text: string, keywords: Set<string>) {
  if (!text || keywords.size === 0) return text;

  // Build pattern from this paper's own keywords
  const escaped = Array.from(keywords)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(k => k.length > 2)
    .join('|');

  if (!escaped) return text;

  try {
    const pattern = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(pattern);
    return parts.map((part, i) =>
      pattern.test(part)
        ? <mark key={i} style={{
            background: 'rgba(255,255,255,0.09)',
            color: 'rgba(255,255,255,0.88)',
            borderRadius: '8px',
            padding: '0 3px',
            fontWeight: 500,
          }}>{part}</mark>
        : part
    );
  } catch {
    return text;
  }
}

// ── Parallel database fetchers ──
async function fetchPubMed(query: string): Promise<Article[]> {
  const s = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}+AND+(synthetic+biology+OR+metabolic+engineering+OR+fermentation)&retmax=3&sort=relevance&retmode=json`);
  const sd = await s.json();
  const ids: string[] = sd.esearchresult?.idlist || [];
  if (!ids.length) return [];
  const sum = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
  const sumd = await sum.json();
  return Promise.all((sumd.result?.uids || []).map(async (uid: string) => {
    const item = sumd.result[uid];
    let abstract = '';
    try {
      const r = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${uid}&rettype=abstract&retmode=xml`);
      const xml = new DOMParser().parseFromString(await r.text(), 'text/xml');
      abstract = Array.from(xml.querySelectorAll('AbstractText')).map(e => e.textContent || '').join(' ');
    } catch {}
    return { id: `pm-${uid}`, title: item.title || '', abstract, authors: item.authors?.slice(0,3).map((a:any)=>a.name)||[], journal: item.source||'', year: item.pubdate?.split(' ')[0]||'', doi: item.articleids?.find((a:any)=>a.idtype==='doi')?.value||'', url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`, source: 'PubMed' };
  }));
}

async function fetchEuropePMC(query: string): Promise<Article[]> {
  const r = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}+AND+(TITLE_ABS:"metabolic engineering" OR TITLE_ABS:"synthetic biology")&format=json&pageSize=3&sort=CITED`);
  const d = await r.json();
  return (d.resultList?.result||[]).map((item:any)=>({ id:`epmc-${item.id}`, title:item.title||'', abstract:item.abstractText||'', authors:item.authorString?item.authorString.split(',').slice(0,3):[], journal:item.journalTitle||'', year:item.pubYear||'', doi:item.doi||'', url:item.doi?`https://doi.org/${item.doi}`:`https://europepmc.org/article/${item.source}/${item.id}`, source:'Europe PMC', citationCount:item.citedByCount, openAccess:item.isOpenAccess==='Y' }));
}

async function fetchSemanticScholar(query: string): Promise<Article[]> {
  const r = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,abstract,authors,year,journal,externalIds,citationCount,isOpenAccess,venue&limit=3`);
  const d = await r.json();
  return (d.data||[]).map((item:any)=>({ id:`ss-${item.paperId}`, title:item.title||'', abstract:item.abstract||'', authors:item.authors?.slice(0,3).map((a:any)=>a.name)||[], journal:item.venue||item.journal?.name||'', year:item.year?.toString()||'', doi:item.externalIds?.DOI||'', url:item.externalIds?.DOI?`https://doi.org/${item.externalIds.DOI}`:`https://www.semanticscholar.org/paper/${item.paperId}`, source:'Semantic Scholar', citationCount:item.citationCount, openAccess:item.isOpenAccess }));
}

async function fetchOpenAlex(query: string): Promise<Article[]> {
  const r = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=concepts.display_name:Biology|Biochemistry|Biotechnology&per-page=3&sort=cited_by_count:desc&mailto=nexusbio@research.com`);
  const d = await r.json();
  return (d.results||[]).map((item:any)=>{ const doi=item.doi?.replace('https://doi.org/','')||''; return { id:`oa-${item.id}`, title:item.title||'', abstract:item.abstract||'', authors:item.authorships?.slice(0,3).map((a:any)=>a.author?.display_name||'')||[], journal:item.primary_location?.source?.display_name||'', year:item.publication_year?.toString()||'', doi, url:item.doi||'', source:'OpenAlex', citationCount:item.cited_by_count, openAccess:item.open_access?.is_oa }; });
}

async function fetchBioRxiv(query: string): Promise<Article[]> {
  const r = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}+AND+SRC:PPR&format=json&pageSize=3&sort=FIRST_PDATE:desc`);
  const d = await r.json();
  return (d.resultList?.result||[]).map((item:any)=>({ id:`biorxiv-${item.id}`, title:item.title||'', abstract:item.abstractText||'', authors:item.authorString?item.authorString.split(',').slice(0,3):[], journal:'bioRxiv', year:item.pubYear||'', doi:item.doi||'', url:item.doi?`https://doi.org/${item.doi}`:'', source:'bioRxiv', isPreprint:true, openAccess:true }));
}

async function fetchCORE(query: string): Promise<Article[]> {
  try {
    const r = await fetch(`https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=3`);
    const d = await r.json();
    return (d.results||[]).map((item:any)=>({ id:`core-${item.id}`, title:item.title||'', abstract:item.abstract||'', authors:item.authors?.slice(0,3).map((a:any)=>a.name||'')||[], journal:item.journals?.[0]?.title||'', year:item.yearPublished?.toString()||'', doi:item.doi||'', url:item.downloadUrl||'', source:'CORE', openAccess:true }));
  } catch { return []; }
}

interface SemanticSearchProps {
  onAnalyzePaper?: (text: string) => void;
}

export default function SemanticSearch({ onAnalyzePaper }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showShowcase, setShowShowcase] = useState(true);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setResults([]);
    setShowShowcase(false);

    const fetchers = [fetchPubMed, fetchEuropePMC, fetchSemanticScholar, fetchOpenAlex, fetchBioRxiv, fetchCORE];
    await Promise.allSettled(fetchers.map(async fn => {
      try {
        const articles = await fn(query);
        setResults(prev => {
          const seen = new Set(prev.map(a => a.title.toLowerCase().slice(0, 60)));
          return [...prev, ...articles.filter(a => a.title && !seen.has(a.title.toLowerCase().slice(0, 60)))];
        });
      } catch {}
    }));
    setIsSearching(false);
  };

  const handleAnalyze = (article: any) => {
    if (onAnalyzePaper) {
      onAnalyzePaper(`Title: ${article.title}\nAuthors: ${article.authors?.join(', ')}\nJournal: ${article.journal} (${article.year})\nAbstract: ${article.abstract}`);
      document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const SendButton = ({ article }: { article: any }) => (
    onAnalyzePaper && article.abstract ? (
      <button
        onClick={() => handleAnalyze(article)}
        title="Analyze pathway"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: '16px', cursor: 'pointer', transition: 'color 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
        <Send size={15} strokeWidth={2} />
      </button>
    ) : null
  );

  return (
    <section className="px-4 py-24" id="search" style={{ background: '#0a0a0a', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            03 · Literature
          </p>
          <h2 style={{ color: '#ffffff', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: '8px', lineHeight: 1.2 }}>
            Database Research
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', lineHeight: 1.6 }}>
            Searches PubMed, Europe PMC, Semantic Scholar, OpenAlex, bioRxiv, and CORE simultaneously —
            over 500 million papers including Nature, Science, and Cell.
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: '40px' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Search size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search across 500M+ papers — e.g. artemisinin biosynthesis, CRISPR metabolic engineering"
            style={{ width: '100%', padding: '14px 130px 14px 46px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', color: '#ffffff', fontSize: '14px', outline: 'none', letterSpacing: '-0.01em', fontFamily: 'inherit' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
          <button type="submit" disabled={isSearching}
            style={{ position: 'absolute', right: '6px', top: '6px', bottom: '6px', padding: '0 18px', background: isSearching ? 'rgba(255,255,255,0.06)' : '#ffffff', color: isSearching ? 'rgba(255,255,255,0.3)' : '#0a0a0a', border: 'none', borderRadius: '16px', fontSize: '13px', fontWeight: 600, cursor: isSearching ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px', letterSpacing: '-0.01em', transition: 'background 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (!isSearching) (e.currentTarget as HTMLElement).style.background = '#e5e5e5'; }}
            onMouseLeave={e => { if (!isSearching) (e.currentTarget as HTMLElement).style.background = '#ffffff'; }}>
            {isSearching ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
            {isSearching ? 'Searching' : 'Search'}
          </button>
        </form>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:0.6} }`}</style>

        {/* Showcase papers */}
        {showShowcase && (
          <div style={{ marginBottom: '40px' }}>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
              Landmark Papers in Synthetic Biology
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
              {SHOWCASE_PAPERS.map((paper, idx) => {
                const isExpanded = expandedIds.has(paper.id);
                return (
                  <div key={paper.id} style={{ background: 'rgba(255,255,255,0.02)', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <div style={{ padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                          {/* Clean metadata line */}
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 8px', letterSpacing: '0.02em' }}>
                            {paper.source} · {paper.year}
                            {paper.citationCount ? ` · ${paper.citationCount.toLocaleString()} citations` : ''}
                          </p>
                          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500, lineHeight: 1.55, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                            {paper.title}
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: 0, letterSpacing: '0.01em' }}>
                            {paper.authors.join(', ')} et al.
                          </p>
                        </div>
                        <button onClick={() => toggleExpand(paper.id)}
                          style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.75, margin: '0 0 12px', letterSpacing: '-0.005em' }}>
                            {highlightKeywords(paper.abstract, extractKeywords(paper.title, paper.abstract))}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>
                              {paper.pathway}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'rgba(255,255,255,0.2)', display: 'flex' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                                <ExternalLink size={13} />
                              </a>
                              <SendButton article={paper} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search results */}
        <div>
          {results.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>
                {results.length} results{isSearching ? ' · searching more databases...' : ''}
              </p>
              <button onClick={() => { setResults([]); setHasSearched(false); setShowShowcase(true); }}
                style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                Clear
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '20px', overflow: 'hidden', border: results.length > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
            {results.map((article, idx) => {
              const isExpanded = expandedIds.has(article.id);
              return (
                <div key={article.id} style={{ background: 'rgba(255,255,255,0.02)', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 8px', letterSpacing: '0.02em' }}>
                          {article.source}
                          {article.journal ? ` · ${article.journal}` : ''}
                          {article.year ? ` · ${article.year}` : ''}
                          {article.citationCount ? ` · ${article.citationCount.toLocaleString()} citations` : ''}
                          {article.isPreprint ? ' · Preprint' : ''}
                          {article.openAccess ? ' · Open Access' : ''}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500, lineHeight: 1.55, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                          {article.title}
                        </p>
                        {article.authors.length > 0 && (
                          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', margin: 0 }}>
                            {article.authors.join(', ')}{article.authors.length === 3 ? ' et al.' : ''}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {article.url && (
                          <a href={article.url} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'rgba(255,255,255,0.2)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button onClick={() => toggleExpand(article.id)}
                          style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && article.abstract && (
                      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.75, margin: '0 0 12px', letterSpacing: '-0.005em' }}>
                          {highlightKeywords(article.abstract, extractKeywords(article.title, article.abstract))}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                          {article.doi && (
                            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, flex: 1 }}>
                              DOI: {article.doi}
                            </p>
                          )}
                          <SendButton article={article} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Loading skeleton */}
          {isSearching && results.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[80, 95, 70].map((w, i) => (
                <div key={i} style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.02)', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div style={{ height: '10px', width: '30%', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', marginBottom: '10px', animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: '14px', width: `${w}%`, background: 'rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '8px', animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: '10px', width: '25%', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
                </div>
              ))}
            </div>
          )}

          {hasSearched && !isSearching && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'rgba(255,255,255,0.2)', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: '20px' }}>
              <p style={{ fontSize: '14px', margin: '0 0 6px', letterSpacing: '-0.01em' }}>No results found for "{query}"</p>
              <p style={{ fontSize: '12px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>Try "lactic acid fermentation" or "E. coli metabolic engineering"</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
