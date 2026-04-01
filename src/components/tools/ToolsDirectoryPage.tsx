'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  Star,
  StarOff,
  Scale,
  X,
} from 'lucide-react';
import TopNav from '../TopNav';
import EmptyState from '../ide/shared/EmptyState';
import Pagination from '../ide/shared/Pagination';
import {
  TOOL_CATEGORIES,
  TOOL_DEFINITIONS,
  type ToolCategory,
  type ToolDefinition,
} from './shared/toolRegistry';

const SANS = "'Inter',-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',monospace";
const STORAGE_KEY = 'nexus-bio-favorite-tools';

type ShellFilter = 'All' | 'ide' | 'bento';
type SortMode = 'name' | 'category' | 'workflow';

function matchesQuery(tool: ToolDefinition, query: string) {
  if (!query.trim()) return true;
  const haystack = [
    tool.shortLabel,
    tool.name,
    tool.summary,
    tool.focus,
    tool.category,
    tool.shell,
    ...tool.outputs,
    ...tool.tags,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.trim().toLowerCase());
}

function compareBy(sortMode: SortMode, tool: ToolDefinition) {
  if (sortMode === 'category') return `${tool.category}-${tool.name}`;
  if (sortMode === 'workflow') return `${tool.shell}-${tool.category}-${tool.name}`;
  return tool.name;
}

export default function ToolsDirectoryPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ToolCategory | 'All'>('All');
  const [shellFilter, setShellFilter] = useState<ShellFilter>('All');
  const [sortMode, setSortMode] = useState<SortMode>('workflow');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedToolId, setSelectedToolId] = useState<string>(TOOL_DEFINITIONS[0]?.id ?? 'pathd');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setFavoriteIds(parsed.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      setFavoriteIds([]);
    }
    setFavoritesReady(true);
  }, []);

  useEffect(() => {
    if (!favoritesReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch {}
  }, [favoriteIds, favoritesReady]);

  const filteredTools = useMemo(() => {
    return [...TOOL_DEFINITIONS]
      .filter((tool) => matchesQuery(tool, query))
      .filter((tool) => category === 'All' || tool.category === category)
      .filter((tool) => shellFilter === 'All' || tool.shell === shellFilter)
      .sort((a, b) => compareBy(sortMode, a).localeCompare(compareBy(sortMode, b)));
  }, [category, query, shellFilter, sortMode]);

  useEffect(() => {
    setPage(1);
  }, [query, category, shellFilter, sortMode]);

  useEffect(() => {
    if (!filteredTools.some((tool) => tool.id === selectedToolId)) {
      setSelectedToolId(filteredTools[0]?.id ?? TOOL_DEFINITIONS[0]?.id ?? 'pathd');
    }
  }, [filteredTools, selectedToolId]);

  const totalPages = Math.max(1, Math.ceil(filteredTools.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pagedTools = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredTools.slice(start, start + pageSize);
  }, [filteredTools, pageSize, safePage]);

  const selectedTool = filteredTools.find((tool) => tool.id === selectedToolId) ?? TOOL_DEFINITIONS[0];
  const comparedTools = TOOL_DEFINITIONS.filter((tool) => compareIds.includes(tool.id));

  function toggleFavorite(toolId: string) {
    setFavoriteIds((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId],
    );
  }

  function toggleCompare(toolId: string) {
    setCompareIds((prev) => {
      if (prev.includes(toolId)) return prev.filter((id) => id !== toolId);
      if (prev.length >= 2) return [prev[1], toolId];
      return [...prev, toolId];
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f5f7fb' }}>
      <TopNav />
      <main style={{ paddingTop: '58px' }}>
        <section style={{ padding: '32px 18px 20px' }}>
          <div style={{ maxWidth: '1480px', margin: '0 auto' }}>
            <div
              style={{
                display: 'grid',
                gap: '24px',
                gridTemplateColumns: 'minmax(0, 1fr)',
              }}
            >
              <header
                style={{
                  display: 'grid',
                  gap: '18px',
                  gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.85fr)',
                  alignItems: 'end',
                }}
                className="nb-directory-hero"
              >
                <div>
                  <p
                    style={{
                      margin: '0 0 10px',
                      fontFamily: MONO,
                      fontSize: '11px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.25)',
                    }}
                  >
                    Tools Directory
                  </p>
                  <h1
                    style={{
                      margin: '0 0 12px',
                      fontFamily: SANS,
                      fontSize: 'clamp(2rem, 5vw, 3.6rem)',
                      lineHeight: 1.03,
                      letterSpacing: '-0.045em',
                    }}
                  >
                    A single scientific workbench entry point for every Nexus-Bio tool.
                  </h1>
                  <p
                    style={{
                      margin: 0,
                      maxWidth: '72ch',
                      fontFamily: SANS,
                      fontSize: '15px',
                      lineHeight: 1.7,
                      color: 'rgba(255,255,255,0.55)',
                    }}
                  >
                    Find a module, understand what it does, compare it against another tool, and enter the
                    correct route without guessing. The directory keeps the center on task fit rather than visual noise.
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '12px',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  }}
                >
                  {[
                    { label: 'Tools', value: TOOL_DEFINITIONS.length, note: 'All routes indexed' },
                    { label: 'Categories', value: TOOL_CATEGORIES.length, note: 'Grouped by task intent' },
                    { label: 'Shells', value: '2', note: 'IDE and bento workbench' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        borderRadius: '18px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, #050505, #050505)',
                        padding: '16px 18px',
                      }}
                    >
                      <p style={{ margin: '0 0 8px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                        {item.label}
                      </p>
                      <p style={{ margin: '0 0 4px', fontFamily: SANS, fontSize: '28px', fontWeight: 700 }}>
                        {item.value}
                      </p>
                      <p style={{ margin: 0, fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
              </header>

              <div className="nb-directory-layout" style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 320px', gap: '18px' }}>
                <aside
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    alignSelf: 'start',
                    position: 'sticky',
                    top: '84px',
                  }}
                  className="nb-directory-sidebar"
                >
                  <section
                    style={{
                      borderRadius: '20px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: '#050505',
                      padding: '16px',
                    }}
                  >
                    <p style={{ margin: '0 0 12px', fontFamily: MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                      Find a tool
                    </p>
                    <label style={{ display: 'block', marginBottom: '12px' }}>
                      <span style={{ display: 'none' }}>Search tools</span>
                      <div style={{ position: 'relative' }}>
                        <Search
                          size={16}
                          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.36)' }}
                        />
                        <input
                          aria-label="Search tools"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search pathway, omics, CRISPR..."
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            borderRadius: '14px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)',
                            color: '#ffffff',
                            padding: '0 14px 0 40px',
                            fontFamily: SANS,
                            fontSize: '13px',
                          }}
                        />
                      </div>
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <p style={{ margin: '0 0 8px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                          Category
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {(['All', ...TOOL_CATEGORIES] as const).map((item) => {
                            const active = item === category;
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setCategory(item)}
                                aria-pressed={active}
                                style={{
                                  minHeight: '34px',
                                  padding: '0 12px',
                                  borderRadius: '999px',
                                  border: active ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.1)',
                                  background: active ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
                                  color: active ? '#ffffff' : 'rgba(255,255,255,0.5)',
                                  cursor: 'pointer',
                                  fontFamily: SANS,
                                  fontSize: '12px',
                                  textAlign: 'left',
                                }}
                              >
                                {item}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p style={{ margin: '0 0 8px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                          Shell type
                        </p>
                        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr 1fr' }}>
                          {(['All', 'ide', 'bento'] as const).map((item) => {
                            const active = item === shellFilter;
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setShellFilter(item)}
                                aria-pressed={active}
                                style={{
                                  minHeight: '36px',
                                  borderRadius: '12px',
                                  border: active ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.1)',
                                  background: active ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
                                  color: active ? '#ffffff' : 'rgba(255,255,255,0.5)',
                                  cursor: 'pointer',
                                  fontFamily: MONO,
                                  fontSize: '11px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                {item}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label>
                        <p style={{ margin: '0 0 8px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                          Sort
                        </p>
                        <div style={{ position: 'relative' }}>
                          <SlidersHorizontal size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.34)' }} />
                          <select
                            aria-label="Sort tools"
                            value={sortMode}
                            onChange={(event) => setSortMode(event.target.value as SortMode)}
                            style={{
                              width: '100%',
                              minHeight: '42px',
                              borderRadius: '14px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: 'rgba(255,255,255,0.04)',
                              color: '#ffffff',
                              padding: '0 14px 0 38px',
                              fontFamily: SANS,
                              fontSize: '13px',
                            }}
                          >
                            <option value="workflow">Workflow fit</option>
                            <option value="category">Category</option>
                            <option value="name">Name</option>
                          </select>
                        </div>
                      </label>
                    </div>
                  </section>

                  <section
                    style={{
                      borderRadius: '20px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: '#050505',
                      padding: '16px',
                    }}
                  >
                    <p style={{ margin: '0 0 12px', fontFamily: MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                      Active state
                    </p>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>Favorites</span>
                        <span style={{ fontFamily: MONO, fontSize: '12px', color: '#ffffff' }}>{favoriteIds.length}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>Compare tray</span>
                        <span style={{ fontFamily: MONO, fontSize: '12px', color: '#ffffff' }}>{compareIds.length}/2</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>Current page</span>
                        <span style={{ fontFamily: MONO, fontSize: '12px', color: '#ffffff' }}>{safePage}/{totalPages}</span>
                      </div>
                    </div>
                  </section>
                </aside>

                <section
                  style={{
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {compareIds.length > 0 && (
                    <div
                      style={{
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: '#050505',
                        padding: '14px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                            Compare tray
                          </p>
                          <p style={{ margin: 0, fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                            Pin up to two tools to compare category, outputs, and shell model side by side.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCompareIds([])}
                          style={{
                            minHeight: '36px',
                            padding: '0 12px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.03)',
                            color: 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                            fontFamily: SANS,
                            fontSize: '12px',
                          }}
                        >
                          Clear compare
                        </button>
                      </div>
                      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: '14px' }}>
                        {comparedTools.map((tool) => (
                          <div
                            key={tool.id}
                            style={{
                              borderRadius: '16px',
                              border: '1px solid rgba(255,255,255,0.08)',
                              background: 'rgba(255,255,255,0.03)',
                              padding: '14px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                              <p style={{ margin: 0, fontFamily: SANS, fontSize: '14px', fontWeight: 600 }}>{tool.name}</p>
                              <button
                                type="button"
                                onClick={() => toggleCompare(tool.id)}
                                aria-label={`Remove ${tool.name} from compare`}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '999px',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  background: 'rgba(255,255,255,0.04)',
                                  color: 'rgba(255,255,255,0.55)',
                                  cursor: 'pointer',
                                  display: 'grid',
                                  placeItems: 'center',
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <dl style={{ margin: 0, display: 'grid', gap: '10px' }}>
                              {[
                                ['Category', tool.category],
                                ['Shell', tool.shell.toUpperCase()],
                                ['Best for', tool.focus],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <dt style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    {label}
                                  </dt>
                                  <dd style={{ margin: 0, fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
                                    {value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      borderRadius: '20px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: '#050505',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                        padding: '16px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div>
                        <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                          Matching tools
                        </p>
                        <p style={{ margin: 0, fontFamily: SANS, fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>
                          {filteredTools.length} tool{filteredTools.length === 1 ? '' : 's'} match the current query and filter state.
                        </p>
                      </div>
                      {(query || category !== 'All' || shellFilter !== 'All') && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuery('');
                            setCategory('All');
                            setShellFilter('All');
                            setSortMode('workflow');
                          }}
                          style={{
                            minHeight: '36px',
                            padding: '0 12px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.03)',
                            color: 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                            fontFamily: SANS,
                            fontSize: '12px',
                          }}
                        >
                          Reset filters
                        </button>
                      )}
                    </div>

                    {pagedTools.length === 0 ? (
                      <div style={{ minHeight: '320px' }}>
                        <EmptyState
                          title="No tool matches the current filters"
                          message="Try removing a category or shell filter, or search with a broader scientific term."
                        />
                      </div>
                    ) : (
                      <div className="nb-directory-cards" style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', padding: '16px' }}>
                        {pagedTools.map((tool) => {
                          const Icon = tool.icon;
                          const isSelected = tool.id === selectedToolId;
                          const isFavorite = favoriteIds.includes(tool.id);
                          const isCompared = compareIds.includes(tool.id);

                          return (
                            <article
                              key={tool.id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '14px',
                                minHeight: '100%',
                                borderRadius: '18px',
                                border: isSelected ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)',
                                background: isSelected ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.03)',
                                padding: '16px',
                                boxShadow: isSelected ? '0 12px 36px rgba(7,15,24,0.42)' : 'none',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                                <div style={{ display: 'flex', gap: '12px', minWidth: 0 }}>
                                  <div
                                    style={{
                                      width: '42px',
                                      height: '42px',
                                      borderRadius: '14px',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      background: 'rgba(255,255,255,0.04)',
                                      display: 'grid',
                                      placeItems: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Icon size={18} style={{ color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)' }} />
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                                      {tool.shortLabel} · {tool.category}
                                    </p>
                                    <h2 style={{ margin: '0 0 6px', fontFamily: SANS, fontSize: '17px', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                                      {tool.name}
                                    </h2>
                                    <p style={{ margin: 0, fontFamily: SANS, fontSize: '13px', lineHeight: 1.65, color: 'rgba(255,255,255,0.55)' }}>
                                      {tool.summary}
                                    </p>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => toggleFavorite(tool.id)}
                                    aria-pressed={isFavorite}
                                    aria-label={isFavorite ? `Remove ${tool.name} from favorites` : `Favorite ${tool.name}`}
                                    style={{
                                      width: '34px',
                                      height: '34px',
                                      borderRadius: '999px',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      background: isFavorite ? 'rgba(255,212,92,0.14)' : 'rgba(255,255,255,0.03)',
                                      color: isFavorite ? 'rgba(255,212,92,0.92)' : 'rgba(255,255,255,0.45)',
                                      cursor: 'pointer',
                                      display: 'grid',
                                      placeItems: 'center',
                                    }}
                                  >
                                    {isFavorite ? <Star size={16} /> : <StarOff size={16} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleCompare(tool.id)}
                                    aria-pressed={isCompared}
                                    aria-label={isCompared ? `Remove ${tool.name} from compare` : `Add ${tool.name} to compare`}
                                    style={{
                                      width: '34px',
                                      height: '34px',
                                      borderRadius: '999px',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      background: isCompared ? 'rgba(143,239,197,0.14)' : 'rgba(255,255,255,0.03)',
                                      color: isCompared ? 'rgba(143,239,197,0.95)' : 'rgba(255,255,255,0.45)',
                                      cursor: 'pointer',
                                      display: 'grid',
                                      placeItems: 'center',
                                    }}
                                  >
                                    <Scale size={16} />
                                  </button>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {tool.tags.slice(0, 4).map((tag) => (
                                  <span
                                    key={tag}
                                    style={{
                                      minHeight: '28px',
                                      padding: '0 10px',
                                      borderRadius: '999px',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      background: 'rgba(255,255,255,0.03)',
                                      color: 'rgba(255,255,255,0.5)',
                                      fontFamily: MONO,
                                      fontSize: '10px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>

                              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedToolId(tool.id)}
                                  aria-pressed={isSelected}
                                  style={{
                                    minHeight: '38px',
                                    padding: '0 14px',
                                    borderRadius: '12px',
                                    border: isSelected ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.1)',
                                    background: isSelected ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.04)',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    fontFamily: SANS,
                                    fontSize: '13px',
                                    fontWeight: 600,
                                  }}
                                >
                                  {isSelected ? 'Inspecting' : 'Inspect'}
                                </button>

                                <Link
                                  href={tool.href}
                                  style={{
                                    minHeight: '38px',
                                    padding: '0 14px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    background: '#f4f7fb',
                                    color: '#000000',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontFamily: SANS,
                                    fontSize: '13px',
                                    fontWeight: 700,
                                  }}
                                >
                                  Open tool <ArrowUpRight size={14} />
                                </Link>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}

                    <Pagination
                      totalItems={filteredTools.length}
                      currentPage={safePage}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                      pageSizeOptions={[4, 6, 8, 12]}
                      itemLabel="tools"
                    />
                  </div>
                </section>

                <aside
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    alignSelf: 'start',
                    position: 'sticky',
                    top: '84px',
                  }}
                  className="nb-directory-detail"
                >
                  <section
                    style={{
                      borderRadius: '20px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: '#050505',
                      padding: '18px',
                    }}
                  >
                    <p style={{ margin: '0 0 12px', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                      Selected tool
                    </p>
                    {selectedTool ? (
                      <>
                        <p style={{ margin: '0 0 6px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                          {selectedTool.shortLabel} · {selectedTool.shell.toUpperCase()} SHELL
                        </p>
                        <h2 style={{ margin: '0 0 10px', fontFamily: SANS, fontSize: '22px', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                          {selectedTool.name}
                        </h2>
                        <p style={{ margin: '0 0 16px', fontFamily: SANS, fontSize: '14px', lineHeight: 1.7, color: 'rgba(255,255,255,0.55)' }}>
                          {selectedTool.summary}
                        </p>

                        <div style={{ display: 'grid', gap: '12px' }}>
                          <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                            <p style={{ margin: '0 0 6px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                              Best for
                            </p>
                            <p style={{ margin: 0, fontFamily: SANS, fontSize: '13px', lineHeight: 1.65, color: 'rgba(255,255,255,0.65)' }}>
                              {selectedTool.focus}
                            </p>
                          </div>

                          <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                            <p style={{ margin: '0 0 8px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                              Outputs you can expect
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '8px' }}>
                              {selectedTool.outputs.map((output) => (
                                <li key={output} style={{ fontFamily: SANS, fontSize: '13px', lineHeight: 1.55, color: 'rgba(255,255,255,0.65)' }}>
                                  {output}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {selectedTool.relatedRoutes && selectedTool.relatedRoutes.length > 0 && (
                            <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                              <p style={{ margin: '0 0 8px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                                Related routes
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {selectedTool.relatedRoutes.map((route) => (
                                  <Link
                                    key={route}
                                    href={route}
                                    style={{
                                      minHeight: '32px',
                                      padding: '0 10px',
                                      borderRadius: '999px',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      background: 'rgba(255,255,255,0.02)',
                                      color: 'rgba(255,255,255,0.55)',
                                      textDecoration: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      fontFamily: MONO,
                                      fontSize: '10px',
                                    }}
                                  >
                                    {route.replace('/tools/', '/')}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                          <Link
                            href={selectedTool.href}
                            style={{
                              minHeight: '42px',
                              borderRadius: '14px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: '#f4f7fb',
                              color: '#000000',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              fontFamily: SANS,
                              fontSize: '13px',
                              fontWeight: 700,
                            }}
                          >
                            Enter {selectedTool.shortLabel} <ArrowUpRight size={14} />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <EmptyState title="Select a tool" message="Choose a tool card to inspect workflow fit and outputs." />
                    )}
                  </section>

                  <section
                    style={{
                      borderRadius: '20px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: '#050505',
                      padding: '18px',
                    }}
                  >
                    <p style={{ margin: '0 0 10px', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                      Why this structure
                    </p>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {[
                        'Left column: search, category, shell, and state controls.',
                        'Center: cards and pagination stay focused on discovery and entry.',
                        'Right column: selected-tool detail or compare context prevents context loss.',
                      ].map((line) => (
                        <div key={line} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <CheckCircle2 size={15} style={{ color: 'rgba(143,239,197,0.95)', marginTop: '2px', flexShrink: 0 }} />
                          <p style={{ margin: 0, fontFamily: SANS, fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.55)' }}>
                            {line}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
