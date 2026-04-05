'use client';

import React from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import EmptyState from '../ide/shared/EmptyState';
import DisplayModeToggle, { useDisplayMode } from '../ide/shared/DisplayModeToggle';
import Pagination from '../ide/shared/Pagination';
import {
  TOOL_DEFINITIONS,
  TOOL_DIRECTIONS,
  type ToolDirection,
  type ToolDefinition,
} from './shared/toolRegistry';
import { T } from '../ide/tokens';

const STORAGE_KEY = 'nexus-bio-favorite-tools';

type ShellFilter = 'All' | 'ide' | 'bento';
type SortMode = 'name' | 'category' | 'workflow';

const DIRECTION_NOTES: Record<string, string> = {
  'Research Intake': 'Use this layer to move from papers, citations, and evidence into a concrete tool route.',
  'Pathway & Design': 'Best when the next step is route selection, node inspection, and pathway-level intervention.',
  'Structure & Enzyme': 'Use for protein structure, catalyst ranking, and evolution-driven design refinement.',
  'Dynamic & System': 'Use when kinetics, control, thermodynamics, or flux constraints determine the decision.',
  'Omics & Spatial': 'Use when single-cell, spatial, or multi-omics context is needed to interpret a mechanism.',
  'Validation & DBTL': 'Use to translate candidates into validation runs, cell-free checks, and engineering workflow.',
  'AI Assistant': 'Use to synthesize context, compare evidence, and orchestrate next actions across modules.',
};

const DIRECTION_CLUSTER_RECIPES: Record<ToolDirection, {
  demoLabel: string;
  researchLabel: string;
  spotlight: string[];
}> = {
  'Research Intake': {
    demoLabel: 'Paper → evidence → tool handoff',
    researchLabel: 'Source triage, evidence intake, and next-step routing',
    spotlight: ['litsearch', 'paper-analyzer', 'genbio-ai'],
  },
  'Pathway & Design': {
    demoLabel: '3D pathway storytelling and intervention entry',
    researchLabel: 'Route inspection, node drill-down, and downstream execution',
    spotlight: ['pathd', 'catdes'],
  },
  'Structure & Enzyme': {
    demoLabel: 'Candidate enzyme showcase with structure-backed ranking',
    researchLabel: 'Catalyst comparison, structure review, and mutation strategy',
    spotlight: ['catdes', 'proevol'],
  },
  'Dynamic & System': {
    demoLabel: 'System constraint story: flux, control, thermo',
    researchLabel: 'Model tuning, dynamic analysis, and systems-level rejection criteria',
    spotlight: ['fbasim', 'dyncon', 'cethx'],
  },
  'Omics & Spatial': {
    demoLabel: 'Layered cell-state and spatial context walkthrough',
    researchLabel: 'QC, latent embedding, trajectory, and ranked omics evidence',
    spotlight: ['multio', 'scspatial'],
  },
  'Validation & DBTL': {
    demoLabel: 'From construct to validation loop and reactor twin',
    researchLabel: 'DBTL orchestration, simulation validation, and learn-loop capture',
    spotlight: ['cellfree', 'dbtlflow', 'genmim'],
  },
  'AI Assistant': {
    demoLabel: 'Narrative copilot across the workbench',
    researchLabel: 'Cross-tool synthesis, comparison, and action orchestration',
    spotlight: ['genbio-ai'],
  },
};

function matchesQuery(tool: ToolDefinition, query: string) {
  if (!query.trim()) return true;
  const haystack = [
    tool.shortLabel,
    tool.name,
    tool.summary,
    tool.focus,
    tool.category,
    tool.direction,
    tool.mode,
    tool.threeDPotential,
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
  if (sortMode === 'workflow') return `${tool.direction}-${tool.shell}-${tool.category}-${tool.name}`;
  return tool.name;
}

export default function ToolsDirectoryPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('query') ?? '';
  const initialDirection = searchParams.get('direction') as ToolDirection | null;
  const initialTool = searchParams.get('tool');
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<ToolDirection | 'All'>('All');
  const [shellFilter, setShellFilter] = useState<ShellFilter>('All');
  const [sortMode, setSortMode] = useState<SortMode>('workflow');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedToolId, setSelectedToolId] = useState<string>(TOOL_DEFINITIONS[0]?.id ?? 'pathd');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [relatedPage, setRelatedPage] = useState(1);
  const [displayMode] = useDisplayMode();

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
    if (initialDirection && TOOL_DIRECTIONS.includes(initialDirection)) setDirection(initialDirection);
    if (initialTool) setSelectedToolId(initialTool);
  }, [initialDirection, initialQuery, initialTool]);

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
      .filter((tool) => direction === 'All' || tool.direction === direction)
      .filter((tool) => shellFilter === 'All' || tool.shell === shellFilter)
      .sort((a, b) => compareBy(sortMode, a).localeCompare(compareBy(sortMode, b)));
  }, [direction, query, shellFilter, sortMode]);

  useEffect(() => {
    setPage(1);
  }, [query, direction, shellFilter, sortMode]);

  useEffect(() => {
    if (!filteredTools.some((tool) => tool.id === selectedToolId)) {
      setSelectedToolId(filteredTools[0]?.id ?? TOOL_DEFINITIONS[0]?.id ?? 'pathd');
    }
  }, [filteredTools, selectedToolId]);

  useEffect(() => {
    setRelatedPage(1);
  }, [selectedToolId]);

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
  const relatedTools = useMemo(() => {
    if (!selectedTool) return [];
    return TOOL_DEFINITIONS.filter((tool) =>
      tool.id !== selectedTool.id &&
      (tool.direction === selectedTool.direction ||
        selectedTool.relatedRoutes?.includes(tool.href) ||
        tool.relatedRoutes?.includes(selectedTool.href)),
    );
  }, [selectedTool]);
  const relatedPageSize = 3;
  const relatedTotalPages = Math.max(1, Math.ceil(relatedTools.length / relatedPageSize));
  const safeRelatedPage = Math.min(relatedPage, relatedTotalPages);
  const visibleRelatedTools = useMemo(() => {
    const start = (safeRelatedPage - 1) * relatedPageSize;
    return relatedTools.slice(start, start + relatedPageSize);
  }, [relatedTools, safeRelatedPage]);
  const directionClusters = useMemo(
    () => TOOL_DIRECTIONS.map((currentDirection) => ({
      direction: currentDirection,
      tools: TOOL_DEFINITIONS
        .filter((tool) => tool.direction === currentDirection)
        .sort((a, b) => {
          const aIndex = DIRECTION_CLUSTER_RECIPES[currentDirection].spotlight.indexOf(a.id);
          const bIndex = DIRECTION_CLUSTER_RECIPES[currentDirection].spotlight.indexOf(b.id);
          const aScore = aIndex === -1 ? 99 : aIndex;
          const bScore = bIndex === -1 ? 99 : bIndex;
          return aScore - bScore || a.name.localeCompare(b.name);
        })
        .slice(0, displayMode === 'demo' ? 2 : 4),
      total: TOOL_DEFINITIONS.filter((tool) => tool.direction === currentDirection).length,
      strong3d: TOOL_DEFINITIONS.filter((tool) => tool.direction === currentDirection && tool.threeDPotential === 'strong').length,
    })),
    [displayMode],
  );

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
    // position:absolute + inset:0 fills the nb-ide-main container provided
    // by the persistent ToolsLayoutShell (app/tools/layout.tsx)
    <div style={{ position: 'absolute', inset: 0, background: '#000000', color: '#f5f7fb', overflow: 'auto' }}>
      <main>
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
                      fontFamily: T.MONO,
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
                      fontFamily: T.SANS,
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
                      fontFamily: T.SANS,
                      fontSize: '15px',
                      lineHeight: 1.7,
                      color: 'rgba(255,255,255,0.55)',
                    }}
                  >
                    {displayMode === 'demo'
                      ? 'Browse by research direction, open the strongest demo paths, and move through the platform without losing story flow.'
                      : 'Find a module, understand what it does, compare it against another tool, and enter the correct route without guessing. The directory keeps the center on task fit rather than visual noise.'}
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
                      { label: 'Directions', value: TOOL_DIRECTIONS.length, note: 'Grouped by research workflow' },
                      { label: '3D-ready', value: TOOL_DEFINITIONS.filter((tool) => tool.threeDPotential !== 'none').length, note: 'Strong or supporting spatial models' },
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
                      <p style={{ margin: '0 0 8px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                        {item.label}
                      </p>
                      <p style={{ margin: '0 0 4px', fontFamily: T.SANS, fontSize: '28px', fontWeight: 700 }}>
                        {item.value}
                      </p>
                      <p style={{ margin: 0, fontFamily: T.SANS, fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                        {item.note}
                      </p>
                    </div>
                    ))}
                </div>
              </header>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                  padding: '16px 18px',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: '#050505',
                }}
              >
                <div>
                  <p style={{ margin: '0 0 6px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                    Display mode
                  </p>
                  <p style={{ margin: 0, fontFamily: T.SANS, fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.55)' }}>
                    {displayMode === 'demo'
                      ? 'Highlights direction clusters and high-signal entry points for presentation and walkthroughs.'
                      : 'Keeps evidence, compare context, adjacency, and workflow fit visible for detailed research use.'}
                  </p>
                </div>
                <DisplayModeToggle />
              </div>

              {/* ── 4-Stage Workflow Flow Guide ────────────────────────── */}
              <section
                style={{
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: '#050505',
                  padding: '16px 18px',
                }}
              >
                <p style={{ margin: '0 0 14px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                  Workflow Path
                </p>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', overflowX: 'auto' }}>
                  {([
                    {
                      stage: 1,
                      label: 'Discover',
                      tagline: 'Papers → Evidence → Route',
                      desc: 'Import literature, extract pathway context, and decide which tools to use.',
                      color: '#C8E8F0',
                      bgColor: 'rgba(200,232,240,0.06)',
                      borderColor: 'rgba(200,232,240,0.2)',
                      directions: ['Research Intake'] as ToolDirection[],
                      toolIds: ['litsearch', 'paper-analyzer', 'genbio-ai'],
                    },
                    {
                      stage: 2,
                      label: 'Design',
                      tagline: 'Pathway → Structure → Candidate',
                      desc: 'Map routes, inspect enzyme nodes, and rank structural candidates.',
                      color: '#C8E0D0',
                      bgColor: 'rgba(200,224,208,0.06)',
                      borderColor: 'rgba(200,224,208,0.2)',
                      directions: ['Pathway & Design', 'Structure & Enzyme'] as ToolDirection[],
                      toolIds: ['pathd', 'catdes', 'proevol'],
                    },
                    {
                      stage: 3,
                      label: 'Simulate',
                      tagline: 'Flux → Dynamics → Omics',
                      desc: 'Run FBA, PID bioreactor control, thermodynamics, and multi-omics analysis.',
                      color: '#DDD0E8',
                      bgColor: 'rgba(221,208,232,0.06)',
                      borderColor: 'rgba(221,208,232,0.2)',
                      directions: ['Dynamic & System', 'Omics & Spatial'] as ToolDirection[],
                      toolIds: ['fbasim', 'dyncon', 'cethx'],
                    },
                    {
                      stage: 4,
                      label: 'Validate',
                      tagline: 'Cell-free → DBTL → Learn',
                      desc: 'Translate candidates into cell-free experiments, DBTL loops, and construct generation.',
                      color: '#E8DCC8',
                      bgColor: 'rgba(232,220,200,0.06)',
                      borderColor: 'rgba(232,220,200,0.2)',
                      directions: ['Validation & DBTL', 'AI Assistant'] as ToolDirection[],
                      toolIds: ['cellfree', 'dbtlflow', 'genmim'],
                    },
                  ] as const).map((s, i, arr) => (
                    <React.Fragment key={s.stage}>
                      <button
                        type="button"
                        onClick={() => setDirection(s.directions[0])}
                        style={{
                          flex: '1 1 0',
                          minWidth: '160px',
                          padding: '14px 16px',
                          borderRadius: '16px',
                          border: `1px solid ${s.borderColor}`,
                          background: s.bgColor,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontFamily: T.MONO, fontSize: '9px', fontWeight: 700, color: s.color, opacity: 0.7 }}>
                            STAGE {s.stage}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 4px', fontFamily: T.SANS, fontSize: '14px', fontWeight: 700, color: s.color }}>
                          {s.label}
                        </p>
                        <p style={{ margin: '0 0 8px', fontFamily: T.MONO, fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>
                          {s.tagline}
                        </p>
                        <p style={{ margin: 0, fontFamily: T.SANS, fontSize: '11px', lineHeight: 1.5, color: 'rgba(255,255,255,0.4)' }}>
                          {s.desc}
                        </p>
                      </button>
                      {i < arr.length - 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', flexShrink: 0, color: 'rgba(255,255,255,0.15)', fontSize: '18px' }}>
                          →
                        </div>
                      )}
                    </React.Fragment>
                  ))}
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
                <p style={{ margin: '0 0 12px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                  Direction clusters
                </p>
                <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  {directionClusters.map((cluster) => (
                    <div
                      key={cluster.direction}
                      style={{
                        borderRadius: '18px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: direction === cluster.direction ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                        padding: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                        <div>
                          <p style={{ margin: '0 0 4px', fontFamily: T.SANS, fontSize: '13px', fontWeight: 700 }}>{cluster.direction}</p>
                          <p style={{ margin: 0, fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                            {cluster.total} tools · {cluster.strong3d} strong 3D
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDirection(cluster.direction)}
                          style={{
                            minHeight: '30px',
                            padding: '0 10px',
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.03)',
                            color: 'rgba(255,255,255,0.55)',
                            cursor: 'pointer',
                            fontFamily: T.MONO,
                            fontSize: '10px',
                          }}
                        >
                          Open
                        </button>
                      </div>
                      <p style={{ margin: '0 0 10px', fontFamily: T.SANS, fontSize: '12px', lineHeight: 1.6, color: 'rgba(255,255,255,0.45)' }}>
                        {displayMode === 'demo'
                          ? DIRECTION_CLUSTER_RECIPES[cluster.direction].demoLabel
                          : DIRECTION_CLUSTER_RECIPES[cluster.direction].researchLabel}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {cluster.tools.map((tool) => (
                          <Link
                            key={tool.id}
                            href={tool.href}
                            style={{
                              minHeight: '28px',
                              padding: '0 10px',
                              borderRadius: '999px',
                              border: '1px solid rgba(255,255,255,0.08)',
                              background: tool.threeDPotential === 'strong' ? 'rgba(147,203,82,0.10)' : 'rgba(255,255,255,0.03)',
                              color: tool.threeDPotential === 'strong' ? 'rgba(147,203,82,0.95)' : 'rgba(255,255,255,0.55)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontFamily: T.MONO,
                              fontSize: '10px',
                            }}
                          >
                            {tool.shortLabel}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

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
                    <p style={{ margin: '0 0 12px', fontFamily: T.MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
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
                            fontFamily: T.SANS,
                            fontSize: '13px',
                          }}
                        />
                      </div>
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <p style={{ margin: '0 0 8px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                          Direction
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {(['All', ...TOOL_DIRECTIONS] as const).map((item) => {
                            const active = item === direction;
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setDirection(item)}
                                aria-pressed={active}
                                style={{
                                  minHeight: '34px',
                                  padding: '0 12px',
                                  borderRadius: '999px',
                                  border: active ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.1)',
                                  background: active ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
                                  color: active ? '#ffffff' : 'rgba(255,255,255,0.5)',
                                  cursor: 'pointer',
                                  fontFamily: T.SANS,
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
                        <p style={{ margin: '0 0 8px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
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
                                  fontFamily: T.MONO,
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
                        <p style={{ margin: '0 0 8px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
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
                              fontFamily: T.SANS,
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
                    <p style={{ margin: '0 0 12px', fontFamily: T.MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                      Active state
                    </p>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontFamily: T.SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>Display mode</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '12px', color: '#ffffff' }}>{displayMode}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontFamily: T.SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>Favorites</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '12px', color: '#ffffff' }}>{favoriteIds.length}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontFamily: T.SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>Compare tray</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '12px', color: '#ffffff' }}>{compareIds.length}/2</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontFamily: T.SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>Current page</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '12px', color: '#ffffff' }}>{safePage}/{totalPages}</span>
                      </div>
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
                    <p style={{ margin: '0 0 10px', fontFamily: T.MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                      Research directions
                    </p>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {TOOL_DIRECTIONS.map((item) => {
                        const active = direction === item;
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setDirection(item)}
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              borderRadius: '14px',
                              border: active ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.08)',
                              background: active ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                              color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontFamily: T.SANS, fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>{item}</div>
                            <div style={{ fontFamily: T.SANS, fontSize: '11px', lineHeight: 1.5, color: active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)' }}>
                              {DIRECTION_NOTES[item]}
                            </div>
                          </button>
                        );
                      })}
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
                  {displayMode === 'research' && compareIds.length > 0 && (
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
                          <p style={{ margin: '0 0 4px', fontFamily: T.MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                            Compare tray
                          </p>
                          <p style={{ margin: 0, fontFamily: T.SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
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
                            fontFamily: T.SANS,
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
                              <p style={{ margin: 0, fontFamily: T.SANS, fontSize: '14px', fontWeight: 600 }}>{tool.name}</p>
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
                                ['Direction', tool.direction],
                                ['Shell', tool.shell.toUpperCase()],
                                ['3D', tool.threeDPotential.toUpperCase()],
                                ['Best for', tool.focus],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <dt style={{ fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    {label}
                                  </dt>
                                  <dd style={{ margin: 0, fontFamily: T.SANS, fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
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
                        <p style={{ margin: '0 0 4px', fontFamily: T.MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                          Matching tools
                        </p>
                        <p style={{ margin: 0, fontFamily: T.SANS, fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>
                          {filteredTools.length} tool{filteredTools.length === 1 ? '' : 's'} match the current query and filter state.
                        </p>
                      </div>
                      {(query || direction !== 'All' || shellFilter !== 'All') && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuery('');
                            setDirection('All');
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
                            fontFamily: T.SANS,
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
                                    <p style={{ margin: '0 0 4px', fontFamily: T.MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                                      {tool.shortLabel} · {tool.direction}
                                    </p>
                                    <h2 style={{ margin: '0 0 6px', fontFamily: T.SANS, fontSize: '17px', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                                      {tool.name}
                                    </h2>
                                    <p style={{ margin: 0, fontFamily: T.SANS, fontSize: '13px', lineHeight: 1.65, color: 'rgba(255,255,255,0.55)' }}>
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
                                      fontFamily: T.MONO,
                                      fontSize: '10px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                                <span
                                  style={{
                                    minHeight: '28px',
                                    padding: '0 10px',
                                    borderRadius: '999px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: tool.threeDPotential === 'strong' ? 'rgba(147,203,82,0.14)' : tool.threeDPotential === 'supporting' ? 'rgba(81,81,205,0.14)' : 'rgba(255,255,255,0.03)',
                                    color: tool.threeDPotential === 'strong' ? 'rgba(147,203,82,0.92)' : tool.threeDPotential === 'supporting' ? 'rgba(160,160,255,0.92)' : 'rgba(255,255,255,0.45)',
                                    fontFamily: T.MONO,
                                    fontSize: '10px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  3D:{tool.threeDPotential}
                                </span>
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
                                    fontFamily: T.SANS,
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
                                    fontFamily: T.SANS,
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
                    <p style={{ margin: '0 0 12px', fontFamily: T.MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                      Selected tool
                    </p>
                    {selectedTool ? (
                      <>
                          <p style={{ margin: '0 0 6px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                          {selectedTool.shortLabel} · {selectedTool.direction}
                          </p>
                        <h2 style={{ margin: '0 0 10px', fontFamily: T.SANS, fontSize: '22px', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                          {selectedTool.name}
                        </h2>
                        <p style={{ margin: '0 0 16px', fontFamily: T.SANS, fontSize: '14px', lineHeight: 1.7, color: 'rgba(255,255,255,0.55)' }}>
                          {selectedTool.summary}
                        </p>

                        <div style={{ display: 'grid', gap: '12px' }}>
                          <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                            <p style={{ margin: '0 0 6px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                              {displayMode === 'demo' ? 'Story fit' : 'Best for'}
                            </p>
                            <p style={{ margin: 0, fontFamily: T.SANS, fontSize: '13px', lineHeight: 1.65, color: 'rgba(255,255,255,0.65)' }}>
                              {displayMode === 'demo'
                                ? DIRECTION_CLUSTER_RECIPES[selectedTool.direction].demoLabel
                                : selectedTool.focus}
                            </p>
                          </div>

                          <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                            <p style={{ margin: '0 0 6px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                              {displayMode === 'demo' ? 'Direction cluster' : 'Direction fit'}
                            </p>
                            <p style={{ margin: '0 0 8px', fontFamily: T.SANS, fontSize: '13px', lineHeight: 1.65, color: 'rgba(255,255,255,0.65)' }}>
                              {selectedTool.direction} · {selectedTool.mode} mode · {selectedTool.shell.toUpperCase()} shell
                            </p>
                            <p style={{ margin: 0, fontFamily: T.MONO, fontSize: '10px', color: selectedTool.threeDPotential === 'strong' ? 'rgba(147,203,82,0.9)' : selectedTool.threeDPotential === 'supporting' ? 'rgba(160,160,255,0.9)' : 'rgba(255,255,255,0.35)' }}>
                              3D potential: {selectedTool.threeDPotential}
                            </p>
                          </div>

                          <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                            <p style={{ margin: '0 0 6px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                              {displayMode === 'demo' ? 'Guided route' : 'Workflow map'}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                              {[
                                { label: 'Research Intake', active: selectedTool.direction === 'Research Intake' },
                                { label: selectedTool.direction, active: true },
                                { label: selectedTool.shortLabel, active: true },
                                { label: 'Validation', active: selectedTool.direction === 'Validation & DBTL' },
                              ].map((step, index) => (
                                <div key={`${step.label}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    minHeight: '28px',
                                    padding: '0 10px',
                                    borderRadius: '999px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: step.active ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                                    color: step.active ? '#ffffff' : 'rgba(255,255,255,0.35)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontFamily: T.MONO,
                                    fontSize: '10px',
                                  }}>
                                    {step.label}
                                  </span>
                                  {index < 3 && <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '10px' }}>→</span>}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                            <p style={{ margin: '0 0 8px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                              {displayMode === 'demo' ? 'What this shows best' : 'Outputs you can expect'}
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '8px' }}>
                              {(displayMode === 'demo' ? selectedTool.outputs.slice(0, 2) : selectedTool.outputs).map((output) => (
                                <li key={output} style={{ fontFamily: T.SANS, fontSize: '13px', lineHeight: 1.55, color: 'rgba(255,255,255,0.65)' }}>
                                  {output}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {displayMode === 'research' && selectedTool.relatedRoutes && selectedTool.relatedRoutes.length > 0 && (
                            <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                              <p style={{ margin: '0 0 8px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
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
                                      fontFamily: T.MONO,
                                      fontSize: '10px',
                                    }}
                                  >
                                    {route.replace('/tools/', '/')}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                          {relatedTools.length > 0 && (
                            <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                              <p style={{ margin: '0 0 8px', fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                                {displayMode === 'demo' ? 'Continue with' : 'Adjacent tools'}
                              </p>
                              <div style={{ display: 'grid', gap: '8px' }}>
                                {visibleRelatedTools.map((tool) => (
                                  <Link
                                    key={tool.id}
                                    href={tool.href}
                                    style={{
                                      borderRadius: '12px',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      background: 'rgba(255,255,255,0.02)',
                                      padding: '10px 12px',
                                      textDecoration: 'none',
                                      color: '#ffffff',
                                    }}
                                  >
                                    <div style={{ fontFamily: T.SANS, fontSize: '12px', fontWeight: 700, marginBottom: '3px' }}>
                                      {tool.shortLabel} · {tool.name}
                                    </div>
                                    <div style={{ fontFamily: T.SANS, fontSize: '11px', lineHeight: 1.5, color: 'rgba(255,255,255,0.45)' }}>
                                      {tool.focus}
                                    </div>
                                  </Link>
                                ))}
                              </div>
                              {relatedTools.length > relatedPageSize && (
                                <div style={{ marginTop: '10px' }}>
                                  <Pagination
                                    totalItems={relatedTools.length}
                                    currentPage={safeRelatedPage}
                                    pageSize={relatedPageSize}
                                    onPageChange={setRelatedPage}
                                    itemLabel="adjacent tools"
                                  />
                                </div>
                              )}
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
                              fontFamily: T.SANS,
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
                    <p style={{ margin: '0 0 10px', fontFamily: T.MONO, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
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
                          <p style={{ margin: 0, fontFamily: T.SANS, fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.55)' }}>
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
