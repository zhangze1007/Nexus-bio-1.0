import { useState, useRef } from 'react';
import { Search, ExternalLink, Sparkles, Loader2, ChevronDown, ChevronUp, Dna } from 'lucide-react';

const ACCENT = '#6495ED'; // Cornflower Blue
const ACCENT_DIM = 'rgba(100,149,237,0.15)';
const ACCENT_BORDER = 'rgba(100,149,237,0.25)';

interface PubMedArticle {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  year: string;
  doi: string;
  pubmedUrl: string;
}

const SHOWCASE_PAPERS = [
  {
    id: 'showcase1',
    title: 'Creation of a Bacterial Cell Controlled by a Chemically Synthesized Genome',
    authors: ['Gibson D.G.', 'Glass J.I.', 'Venter J.C.'],
    journal: 'Science',
    year: '2010',
    abstract: 'We report the design, synthesis, and assembly of the 1.08-Mbp Mycoplasma mycoides JCVI-syn1.0 genome starting from digitized genome sequence information and its transplantation into a M. capricolum recipient cell to create new M. mycoides cells that are controlled only by the synthetic chromosome.',
    doi: '10.1126/science.1190719',
    pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/20488990/',
    pathway: 'Synthetic genome → Chromosome transplantation → Cellular reprogramming → Metabolic activity',
  },
  {
    id: 'showcase2',
    title: 'Complete Biosynthesis of Opioids in Yeast',
    authors: ['Galanie S.', 'Thodey K.', 'Smolke C.D.'],
    journal: 'Science',
    year: '2015',
    abstract: 'We engineered Saccharomyces cerevisiae to produce the selected opioid compounds thebaine and hydrocodone starting from glucose. We combined enzyme discovery, enzyme engineering, and pathway and strain optimization to realize the 15-step biochemical pathway in yeast.',
    doi: '10.1126/science.aac9373',
    pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/26272907/',
    pathway: 'Glucose → Tyrosine → L-DOPA → Reticuline → Thebaine → Hydrocodone',
  },
  {
    id: 'showcase3',
    title: 'Microbial Production of Fatty-Acid-Derived Fuels and Chemicals',
    authors: ['Steen E.J.', 'Kang Y.', 'Keasling J.D.'],
    journal: 'Nature',
    year: '2010',
    abstract: 'We have engineered Escherichia coli to produce structurally tailored fatty esters, fatty alcohols, and waxes directly from simple sugars. The key was to engineer the cells to overproduce fatty acids and then to express enzymes that convert the fatty acids to the desired products.',
    doi: '10.1038/nature08721',
    pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/20057858/',
    pathway: 'Glucose → Acetyl-CoA → Malonyl-CoA → Fatty Acids → Biodiesel',
  },
];

const BIO_KEYWORDS = [
  'metabolic', 'pathway', 'enzyme', 'biosynthesis', 'fermentation',
  'glucose', 'pyruvate', 'acetyl', 'synthesis', 'expression',
  'gene', 'protein', 'cell', 'yeast', 'bacteria', 'E. coli',
  'CRISPR', 'flux', 'yield', 'titer', 'production', 'engineered',
  'substrate', 'product', 'intermediate', 'cofactor', 'TCA', 'glycolysis',
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

interface SemanticSearchProps {
  onAnalyzePaper?: (text: string) => void;
}

export default function SemanticSearch({ onAnalyzePaper }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PubMedArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showShowcase, setShowShowcase] = useState(true);

  const searchRequestIdRef = useRef(0);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fetchAbstract = async (pmid: string): Promise<string> => {
    try {
      const res = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=xml`
      );
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      return (
        Array.from(xml.querySelectorAll('AbstractText'))
          .map(el => el.textContent || '')
          .join(' ')
          .trim() || 'Abstract not available.'
      );
    } catch {
      return 'Abstract not available.';
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    const requestId = ++searchRequestIdRef.current;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    setResults([]);
    setShowShowcase(false);
    setExpandedIds(new Set());

    try {
      const searchRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}+AND+(synthetic+biology+OR+metabolic+engineering+OR+fermentation+OR+bioinformatics)&retmax=5&sort=relevance&retmode=json`
      );

      const searchData = await searchRes.json();
      const ids: string[] = searchData.esearchresult?.idlist || [];

      if (requestId !== searchRequestIdRef.current) return;

      if (ids.length === 0) {
        setResults([]);
        return;
      }

      const summaryRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
      );

      const summaryData = await summaryRes.json();
      const uids: string[] = summaryData.result?.uids || [];

      if (requestId !== searchRequestIdRef.current) return;

      const articles: PubMedArticle[] = await Promise.all(
        uids.map(async (uid) => {
          const item = summaryData.result[uid];
          const abstract = await fetchAbstract(uid);

          return {
            id: uid,
            title: item?.title || 'No title',
            abstract,
            authors: item?.authors?.slice(0, 3).map((a: any) => a.name) || [],
            journal: item?.source || '',
            year: item?.pubdate?.split(' ')[0] || '',
            doi: item?.articleids?.find((a: any) => a.idtype === 'doi')?.value || '',
            pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
          };
        })
      );

      if (requestId !== searchRequestIdRef.current) return;

      setResults(articles);
    } catch {
      if (requestId !== searchRequestIdRef.current) return;
      setError('Failed to connect to PubMed. Please try again.');
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleAnalyze = (article: { title: string; authors: string[]; journal: string; year: string; abstract: string }) => {
    if (onAnalyzePaper) {
      onAnalyzePaper(
        `Title: ${article.title}\nAuthors: ${article.authors.join(', ')}\nJournal: ${article.journal} (${article.year})\nAbstract: ${article.abstract}`
      );
      document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="px-4 py-24" id="search" style={{ borderTop: 'none' }}>
      <div className="max-w-4xl mx-auto">

        <div className="mb-12">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
            03 · Literature
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
            Literature Search
          </h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Live search from <span style={{ color: ACCENT }} className="font-mono">PubMed</span> · 35M+ biomedical articles
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative mb-10">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 'succinic acid fermentation', 'CRISPR metabolic engineering'..."
            className="block w-full pl-11 pr-32 py-3.5 rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute inset-y-2 right-2 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-40"
            style={{ background: '#ffffff', color: '#0a0a0a' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e5e5e5'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ffffff'; }}
          >
            {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div
            className="py-4 px-5 rounded-xl text-sm mb-6"
            style={{ background: 'rgba(255,100,100,0.06)', border: '1px solid rgba(255,100,100,0.15)', color: 'rgba(255,150,150,0.8)' }}
          >
            {error}
          </div>
        )}

        {showShowcase && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <Dna size={15} style={{ color: ACCENT }} />
              <h3 className="text-sm font-semibold text-white">Landmark Papers in Synthetic Biology</h3>
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>经典论文</span>
            </div>
            <div className="space-y-3">
              {SHOWCASE_PAPERS.map((paper) => {
                const isExpanded = expandedIds.has(paper.id);
                return (
                  <div
                    key={paper.id}
                    className="rounded-2xl overflow-hidden transition-all"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="text-xs font-mono px-2 py-0.5 rounded-full"
                              style={{ background: ACCENT_DIM, color: ACCENT, border: `1px solid ${ACCENT_BORDER}` }}
                            >
                              {paper.journal} · {paper.year}
                            </span>
                          </div>
                          <h4 className="text-white text-sm font-medium leading-snug mb-1.5">{paper.title}</h4>
                          <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {paper.authors.join(', ')} et al.
                          </p>
                        </div>
                        <button
                          onClick={() => toggleExpand(paper.id)}
                          className="p-1 transition-colors shrink-0"
                          style={{ color: 'rgba(255,255,255,0.25)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)'; }}
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-4 space-y-3">
                          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            {highlightKeywords(paper.abstract)}
                          </p>
                          <div
                            className="flex items-start gap-2 text-xs font-mono px-3 py-2 rounded-lg"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                          >
                            <span style={{ color: ACCENT }}>Pathway →</span>
                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>{paper.pathway}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className="px-5 py-3 flex items-center justify-between"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <button
                        onClick={() => toggleExpand(paper.id)}
                        className="text-xs transition-colors"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)'; }}
                      >
                        {isExpanded ? 'Collapse' : 'Read abstract'}
                      </button>
                      <div className="flex items-center gap-2">
                        <a
                          href={paper.pubmedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'rgba(255,255,255,0.2)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}
                        >
                          <ExternalLink size={13} />
                        </a>
                        {onAnalyzePaper && (
                          <button
                            onClick={() => handleAnalyze(paper)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                            style={{ background: ACCENT_DIM, color: ACCENT, border: `1px solid ${ACCENT_BORDER}` }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(100,149,237,0.25)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ACCENT_DIM; }}
                          >
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

        <div className="space-y-3">
          {results.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {results.length} results from PubMed
              </span>
              <button
                onClick={() => {
                  setResults([]);
                  setHasSearched(false);
                  setShowShowcase(true);
                  setExpandedIds(new Set());
                }}
                className="text-xs transition-colors"
                style={{ color: 'rgba(255,255,255,0.2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}
              >
                Clear results
              </button>
            </div>
          )}

          {results.map((article) => {
            const isExpanded = expandedIds.has(article.id);
            return (
              <div
                key={article.id}
                className="rounded-2xl overflow-hidden transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {article.journal && (
                        <span
                          className="text-xs font-mono px-2 py-0.5 rounded-full inline-block mb-2"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          {article.journal}{article.year ? ` · ${article.year}` : ''}
                        </span>
                      )}
                      <h3 className="text-white text-sm font-medium leading-snug mb-1.5">{article.title}</h3>
                      {article.authors.length > 0 && (
                        <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {article.authors.join(', ')}{article.authors.length === 3 ? ' et al.' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={article.pubmedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'rgba(255,255,255,0.2)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        onClick={() => toggleExpand(article.id)}
                        style={{ color: 'rgba(255,255,255,0.2)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>
                  {isExpanded && article.abstract !== 'Abstract not available.' && (
                    <div className="mt-4">
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {highlightKeywords(article.abstract)}
                      </p>
                      {article.doi && (
                        <p className="text-xs font-mono mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          DOI: {article.doi}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div
                  className="px-5 py-3 flex items-center justify-between"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <button
                    onClick={() => toggleExpand(article.id)}
                    className="text-xs transition-colors"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)'; }}
                  >
                    {isExpanded ? 'Collapse' : 'Read abstract'}
                  </button>
                  {onAnalyzePaper && article.abstract !== 'Abstract not available.' && (
                    <button
                      onClick={() => handleAnalyze(article)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: ACCENT_DIM, color: ACCENT, border: `1px solid ${ACCENT_BORDER}` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(100,149,237,0.25)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ACCENT_DIM; }}
                    >
                      <Sparkles size={11} />
                      Generate Pathway
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {hasSearched && !isSearching && results.length === 0 && (
            <div
              className="text-center py-10 rounded-2xl text-sm"
              style={{ color: 'rgba(255,255,255,0.2)', border: '1px dashed rgba(255,255,255,0.08)' }}
            >
              No results for "{query}". Try "lactic acid bacteria" or "E. coli metabolic engineering".
            </div>
          )}

          {!hasSearched && !showShowcase && (
            <div className="text-center py-10 rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
              <Search size={24} className="mx-auto mb-3 opacity-20" style={{ color: '#fff' }} />
              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Search any metabolic engineering topic above
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
