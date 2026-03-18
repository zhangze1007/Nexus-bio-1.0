import { useState } from 'react';
import { Search, ExternalLink, FileText, Sparkles, Loader2, ChevronDown, ChevronUp, Dna } from 'lucide-react';

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

// Classic synthetic biology showcase papers
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
    pathway: 'Synthetic genome → Cell division → Protein synthesis → Metabolic activity',
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
      ? <mark key={i} className="bg-emerald-500/20 text-emerald-300 rounded px-0.5">{part}</mark>
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

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fetchAbstract = async (pmid: string): Promise<string> => {
    try {
      const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=xml`);
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      return Array.from(xml.querySelectorAll('AbstractText')).map(el => el.textContent || '').join(' ').trim() || 'Abstract not available.';
    } catch { return 'Abstract not available.'; }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true); setError(null); setHasSearched(true); setResults([]); setShowShowcase(false);

    try {
      const searchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}+AND+(synthetic+biology+OR+metabolic+engineering+OR+fermentation+OR+bioinformatics)&retmax=5&sort=relevance&retmode=json`);
      const searchData = await searchRes.json();
      const ids: string[] = searchData.esearchresult?.idlist || [];
      if (ids.length === 0) { setIsSearching(false); return; }

      const summaryRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
      const summaryData = await summaryRes.json();
      const uids: string[] = summaryData.result?.uids || [];

      const articles: PubMedArticle[] = await Promise.all(
        uids.map(async (uid) => {
          const item = summaryData.result[uid];
          const abstract = await fetchAbstract(uid);
          return {
            id: uid,
            title: item.title || 'No title',
            abstract,
            authors: item.authors?.slice(0, 3).map((a: any) => a.name) || [],
            journal: item.source || '',
            year: item.pubdate?.split(' ')[0] || '',
            doi: item.articleids?.find((a: any) => a.idtype === 'doi')?.value || '',
            pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
          };
        })
      );
      setResults(articles);
    } catch { setError('Failed to connect to PubMed. Please try again.'); }
    finally { setIsSearching(false); }
  };

  const handleAnalyze = (article: { title: string; authors: string[]; journal: string; year: string; abstract: string }) => {
    if (onAnalyzePaper) {
      const text = `Title: ${article.title}\nAuthors: ${article.authors.join(', ')}\nJournal: ${article.journal} (${article.year})\nAbstract: ${article.abstract}`;
      onAnalyzePaper(text);
      document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-24 px-4 bg-zinc-950 border-t border-zinc-800" id="search">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-white">Literature Search</h2>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest mb-2">语义文献搜索</p>
          <p className="text-zinc-600 text-sm">
            Live search from <span className="text-emerald-400 font-mono">PubMed</span> · 35M+ biomedical articles
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-10">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-500" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 'succinic acid fermentation', 'CRISPR metabolic engineering'..."
            className="block w-full pl-12 pr-36 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute inset-y-2 right-2 px-5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSearching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="text-center py-6 text-red-400 border border-red-500/20 rounded-2xl bg-red-500/5 mb-8">{error}</div>
        )}

        {/* Showcase Section */}
        {showShowcase && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <Dna size={18} className="text-emerald-400" />
              <h3 className="text-white font-semibold">Classic Papers · Landmark Discoveries</h3>
              <span className="text-xs text-zinc-600 font-mono">手动整理的经典论文</span>
            </div>
            <div className="space-y-3">
              {SHOWCASE_PAPERS.map((paper) => {
                const isExpanded = expandedIds.has(paper.id);
                return (
                  <div key={paper.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                              {paper.journal} · {paper.year}
                            </span>
                          </div>
                          <h4 className="text-white font-semibold leading-snug mb-2">{paper.title}</h4>
                          <p className="text-zinc-500 text-xs font-mono">{paper.authors.join(', ')} et al.</p>
                        </div>
                        <button
                          onClick={() => toggleExpand(paper.id)}
                          className="text-zinc-500 hover:text-white transition-colors p-1 shrink-0"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-3">
                          <p className="text-zinc-300 text-sm leading-relaxed">
                            {highlightKeywords(paper.abstract)}
                          </p>
                          <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 bg-zinc-800/50 px-3 py-2 rounded-xl">
                            <span className="text-emerald-500">Pathway:</span>
                            <span>{paper.pathway}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-zinc-800/60 px-5 py-3 flex items-center justify-between">
                      <button
                        onClick={() => toggleExpand(paper.id)}
                        className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                      >
                        {isExpanded ? 'Collapse' : 'Read abstract'}
                      </button>
                      <div className="flex items-center gap-2">
                        <a href={paper.pubmedUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors">
                          <ExternalLink size={14} />
                        </a>
                        {onAnalyzePaper && (
                          <button
                            onClick={() => handleAnalyze(paper)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl transition-all font-semibold"
                          >
                            <Sparkles size={12} />
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

        {/* Search Results */}
        <div className="space-y-4">
          {results.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <FileText size={16} className="text-zinc-500" />
              <span className="text-zinc-500 text-sm">{results.length} results from PubMed</span>
              <button onClick={() => { setResults([]); setHasSearched(false); setShowShowcase(true); }} className="text-xs text-zinc-600 hover:text-zinc-400 ml-auto transition-colors">
                Clear
              </button>
            </div>
          )}

          {results.map((article) => {
            const isExpanded = expandedIds.has(article.id);
            return (
              <div key={article.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {article.journal && (
                          <span className="text-xs font-mono px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full">
                            {article.journal}{article.year ? ` · ${article.year}` : ''}
                          </span>
                        )}
                      </div>
                      <h3 className="text-emerald-400 font-semibold leading-snug mb-2">{article.title}</h3>
                      {article.authors.length > 0 && (
                        <p className="text-zinc-500 text-xs font-mono">
                          {article.authors.join(', ')}{article.authors.length === 3 ? ' et al.' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={article.pubmedUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors">
                        <ExternalLink size={16} />
                      </a>
                      <button onClick={() => toggleExpand(article.id)} className="text-zinc-500 hover:text-white transition-colors">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && article.abstract && article.abstract !== 'Abstract not available.' && (
                    <div className="mt-4">
                      <p className="text-zinc-300 text-sm leading-relaxed">
                        {highlightKeywords(article.abstract)}
                      </p>
                      {article.doi && (
                        <p className="text-zinc-600 text-xs font-mono mt-3">DOI: {article.doi}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800/60 px-5 py-3 flex items-center justify-between">
                  <button
                    onClick={() => toggleExpand(article.id)}
                    className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                  >
                    {isExpanded ? 'Collapse' : 'Read abstract'}
                  </button>
                  {onAnalyzePaper && article.abstract !== 'Abstract not available.' && (
                    <button
                      onClick={() => handleAnalyze(article)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl transition-all font-semibold"
                    >
                      <Sparkles size={12} />
                      Generate Pathway
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {hasSearched && !isSearching && results.length === 0 && (
            <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
              No results for "{query}". Try "lactic acid bacteria" or "E. coli metabolic engineering".
            </div>
          )}

          {!hasSearched && !showShowcase && (
            <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
              <Search size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-mono">Search any metabolic engineering topic above</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
