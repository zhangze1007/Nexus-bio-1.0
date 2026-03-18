import { useState } from 'react';
import { Search, ExternalLink, FileText, Sparkles, Loader2 } from 'lucide-react';

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

interface SemanticSearchProps {
  onAnalyzePaper?: (text: string) => void;
}

export default function SemanticSearch({ onAnalyzePaper }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PubMedArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchAbstract = async (pmid: string): Promise<string> => {
    try {
      const res = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=xml`
      );
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      const abstractTexts = xml.querySelectorAll('AbstractText');
      const abstract = Array.from(abstractTexts)
        .map((el) => el.textContent || '')
        .join(' ')
        .trim();
      return abstract || 'Abstract not available.';
    } catch {
      return 'Abstract not available.';
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    setResults([]);

    try {
      // Step 1: Search PubMed for IDs
      const searchRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}+AND+(synthetic+biology+OR+metabolic+engineering+OR+fermentation+OR+bioinformatics)&retmax=6&sort=relevance&retmode=json`
      );
      const searchData = await searchRes.json();
      const ids: string[] = searchData.esearchresult?.idlist || [];

      if (ids.length === 0) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      // Step 2: Fetch article details
      const summaryRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
      );
      const summaryData = await summaryRes.json();
      const uids: string[] = summaryData.result?.uids || [];

      // Step 3: Build article list with abstracts
      const articles: PubMedArticle[] = await Promise.all(
        uids.map(async (uid) => {
          const item = summaryData.result[uid];
          const abstract = await fetchAbstract(uid);
          const doi = item.articleids?.find((a: any) => a.idtype === 'doi')?.value || '';

          return {
            id: uid,
            title: item.title || 'No title',
            abstract,
            authors: item.authors?.slice(0, 3).map((a: any) => a.name) || [],
            journal: item.source || '',
            year: item.pubdate?.split(' ')[0] || '',
            doi,
            pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
          };
        })
      );

      setResults(articles);
    } catch (err) {
      setError('Failed to connect to PubMed. Please check your connection and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAnalyze = (article: PubMedArticle) => {
    if (onAnalyzePaper) {
      const text = `Title: ${article.title}\n\nAuthors: ${article.authors.join(', ')}\n\nJournal: ${article.journal} (${article.year})\n\nAbstract: ${article.abstract}`;
      onAnalyzePaper(text);
      document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-24 px-4 bg-zinc-950 text-white" id="search">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Literature Search</h2>
          <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest mb-2">
            语义文献搜索
          </p>
          <p className="text-zinc-500 text-sm">
            Searching real papers from{' '}
            <span className="text-emerald-400 font-mono">PubMed</span>
            {' '}· {' '}
            <span className="text-zinc-400">35M+ biomedical articles</span>
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative mb-12">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-500" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 'succinic acid fermentation', 'CRISPR metabolic engineering'..."
            className="block w-full pl-12 pr-36 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute inset-y-2 right-2 px-6 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSearching ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="text-center py-8 text-red-400 border border-red-500/20 rounded-2xl bg-red-500/5 mb-6">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {results.length > 0 ? (
            results.map((article) => (
              <div
                key={article.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-lg font-semibold text-emerald-400 flex items-start gap-2 leading-snug">
                    <FileText size={18} className="shrink-0 mt-0.5" />
                    {article.title}
                  </h3>
                  <a
                    href={article.pubmedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-white transition-colors shrink-0"
                    title="Open in PubMed"
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {article.authors.length > 0 && (
                    <span className="text-xs text-zinc-500 font-mono">
                      {article.authors.join(', ')}{article.authors.length === 3 ? ' et al.' : ''}
                    </span>
                  )}
                  {article.journal && (
                    <span className="text-xs text-zinc-600">· {article.journal}</span>
                  )}
                  {article.year && (
                    <span className="text-xs text-zinc-600">· {article.year}</span>
                  )}
                </div>

                {article.abstract && article.abstract !== 'Abstract not available.' && (
                  <p className="text-zinc-400 text-sm leading-relaxed mb-4 line-clamp-3">
                    {article.abstract}
                  </p>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  {article.doi && (
                    <span className="text-xs font-mono text-zinc-600 bg-zinc-800 px-2 py-1 rounded-lg">
                      DOI: {article.doi}
                    </span>
                  )}
                  {onAnalyzePaper && article.abstract !== 'Abstract not available.' && (
                    <button
                      onClick={() => handleAnalyze(article)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 text-sm rounded-xl transition-all font-semibold"
                    >
                      <Sparkles size={14} />
                      Generate Pathway
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : hasSearched && !isSearching ? (
            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
              No results found for "{query}". Try "lactic acid bacteria" or "E. coli metabolic engineering".
            </div>
          ) : !hasSearched ? (
            <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
              <Search size={32} className="mx-auto mb-4 opacity-30" />
              <p className="font-mono text-sm">Search any metabolic engineering topic above</p>
              <p className="text-xs mt-2 text-zinc-700">Results pulled live from PubMed database</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
