import { useState } from 'react';
import { Search, ExternalLink, FileText } from 'lucide-react';
import { SearchResult } from '../types';
import mockIndex from '../data/mockIndex.json';

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    
    // Simulate semantic search delay
    setTimeout(() => {
      const q = query.toLowerCase();
      const filtered = mockIndex.filter(doc => 
        doc.title.toLowerCase().includes(q) || 
        doc.extract.toLowerCase().includes(q) ||
        doc.keywords.some(k => k.toLowerCase().includes(q))
      );
      setResults(filtered);
      setIsSearching(false);
    }, 600);
  };

  return (
    <section className="py-24 px-4 bg-zinc-950 text-white" id="search">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Semantic Literature Search</h2>
          <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">语义文献搜索</p>
        </div>

        <form onSubmit={handleSearch} className="relative mb-12">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-500" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for 'precision fermentation', 'biopolymers'..."
            className="block w-full pl-12 pr-32 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute inset-y-2 right-2 px-6 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div className="space-y-6">
          {results.length > 0 ? (
            results.map((result) => (
              <div key={result.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h3 className="text-xl font-semibold text-emerald-400 flex items-center gap-2">
                    <FileText size={20} />
                    {result.title}
                  </h3>
                  <a
                    href={result.sourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-white transition-colors shrink-0"
                  >
                    <ExternalLink size={20} />
                  </a>
                </div>
                <p className="text-zinc-300 leading-relaxed mb-4">
                  "{result.extract}"
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((keyword, i) => (
                    <span key={i} className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-full font-mono">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : query && !isSearching ? (
            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
              No results found for "{query}". Try "fermentation" or "postbiotics".
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
