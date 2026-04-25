'use client';

import {
  useRef, useState, useEffect, useCallback, useTransition,
} from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Search, ArrowRight, Loader2, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import HeroFluidCanvas, { type HeroFluidHandle } from './HeroFluidCanvas';

const BRAND = "'Space Grotesk',-apple-system,sans-serif";
const SANS = "'Public Sans',-apple-system,sans-serif";
const MONO = "'IBM Plex Mono','JetBrains Mono','Fira Code',monospace";

const PLATFORM_SIGNALS = [
  {
    label: '4 stages',
    value: 'Design to iterate',
  },
  {
    label: '13 tools',
    value: 'Pathway, FBA, DBTL, omics',
  },
  {
    label: 'Evidence-linked',
    value: 'Structure, kinetics, literature',
  },
  {
    label: 'Axon support',
    value: 'AI assists while models stay primary',
  },
];

const WORKFLOW_BANDS = [
  {
    label: 'Stage 1',
    title: 'Design & Discovery',
    detail: 'Paper intake, route object, node evidence',
    href: '/tools/pathd',
  },
  {
    label: 'Stage 2',
    title: 'Simulation & Optimization',
    detail: 'Flux, thermodynamics, catalyst ranking',
    href: '/tools/fbasim',
  },
  {
    label: 'Stage 3',
    title: 'Chassis & Control',
    detail: 'Genome edits, circuits, dynamic response',
    href: '/tools/genmim',
  },
  {
    label: 'Stage 4',
    title: 'Test & Iterate',
    detail: 'Cell-free, DBTL, omics, spatial feedback',
    href: '/tools/cellfree',
  },
];

interface PreviewResult {
  id: string;
  title: string;
  publication_year: number | null;
  primary_location?: { source?: { display_name?: string } };
}

async function fetchPreview(q: string): Promise<PreviewResult[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=4&select=id,title,publication_year,primary_location`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []) as PreviewResult[];
}

export default function Hero() {
  const router = useRouter();
  const headerRef = useRef<HTMLElement>(null);
  const fluidRef = useRef<HeroFluidHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [preview, setPreview] = useState<PreviewResult[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [, startTransition] = useTransition();

  const { scrollYProgress } = useScroll({
    target: headerRef,
    offset: ['start start', 'end start'],
  });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -54]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.05]);

  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setPreview([]);
      return;
    }

    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await fetchPreview(query);
        startTransition(() => setPreview(results));
      } catch {
        setPreview([]);
      } finally {
        setPreviewLoading(false);
      }
    }, 380);

    return () => clearTimeout(timer);
  }, [query, startTransition]);

  const navigate = useCallback((q: string) => {
    if (q.trim()) router.push(`/research?q=${encodeURIComponent(q.trim())}`);
  }, [router]);

  const onFocus = useCallback(() => {
    setFocused(true);
    fluidRef.current?.triggerConverge();
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') navigate(query);
    if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  }, [navigate, query]);

  const showPopup = focused && query.length >= 3 && (preview.length > 0 || previewLoading);

  return (
    <header
      ref={headerRef}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '120px clamp(16px, 4vw, 40px) 56px',
      }}
    >
      <HeroFluidCanvas ref={fluidRef} />

      <motion.div
        style={{
          y: titleY,
          opacity: titleOpacity,
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '1180px',
          display: 'grid',
          gap: '30px',
          justifyItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: '18px', maxWidth: '900px' }}>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: MONO,
              fontSize: '10px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.38)',
              margin: 0,
            }}
          >
            Synthetic Biology Research Workbench
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontWeight: 700,
              fontSize: 'clamp(3.35rem, 8vw, 7.25rem)',
              lineHeight: 0.94,
              letterSpacing: '-0.04em',
              fontFamily: BRAND,
              color: '#FFFFFF',
              margin: 0,
              textShadow: '0 0 120px rgba(255,255,255,0.06)',
            }}
          >
            Move from literature to validated pathway decisions
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: SANS,
              fontSize: 'clamp(1rem, 1.8vw, 1.18rem)',
              lineHeight: 1.72,
              color: 'rgba(226,232,240,0.72)',
              margin: '0 auto',
              maxWidth: '760px',
            }}
          >
            Nexus-Bio organizes pathway design, simulation, chassis engineering, and test loops
            inside one 4-stage workbench, so the same route object can move from paper intake to
            flux analysis, control strategy, and validation without losing context.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="nb-hero-actions"
        >
          <Link href="/tools" className="nb-hero-button nb-hero-button--primary">
            Enter Workbench
            <ArrowRight size={14} />
          </Link>
          <Link href="/analyze" className="nb-hero-button nb-hero-button--secondary">
            Analyze Literature
            <ChevronRight size={14} />
          </Link>
          <a href="#workflow" className="nb-hero-button nb-hero-button--ghost">
            Review 4-stage flow
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'relative', width: '100%', maxWidth: '760px' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '0 20px',
              minHeight: '62px',
              borderRadius: '30px',
              background: focused ? 'rgba(15,18,25,0.9)' : 'rgba(15,18,25,0.76)',
              border: focused ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.11)',
              backdropFilter: 'blur(32px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
              boxShadow: focused
                ? '0 0 0 4px rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
                : '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
              transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <Search
              size={16}
              style={{
                color: focused ? 'rgba(255,255,255,0.76)' : 'rgba(255,255,255,0.26)',
                flexShrink: 0,
                transition: 'color 0.2s',
              }}
            />

            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={onFocus}
              onBlur={() => setTimeout(() => setFocused(false), 200)}
              onKeyDown={onKeyDown}
              placeholder="Search papers, pathways, enzymes, host chassis, or omics targets"
              className="nb-hero-search-input"
              aria-label="Search research database"
              autoComplete="off"
              spellCheck={false}
            />

            <button
              onClick={() => navigate(query)}
              className="nb-hero-search-button"
              type="button"
              aria-label="Search research database"
            >
              {previewLoading
                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                : <ArrowRight size={11} />}
              Search
            </button>
          </div>

          {showPopup && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                zIndex: 50,
                borderRadius: '18px',
                background: 'rgba(10,13,20,0.94)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(40px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
                overflow: 'hidden',
              }}
            >
              {previewLoading && preview.length === 0 ? (
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Loader2 size={12} style={{ color: 'rgba(255,255,255,0.75)', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(148,163,184,0.6)' }}>
                    Searching OpenAlex...
                  </span>
                </div>
              ) : preview.map((r, i) => (
                <button
                  key={r.id}
                  onMouseDown={() => navigate(r.title)}
                  type="button"
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 20px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderBottom: i < preview.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  <p
                    style={{
                      fontFamily: SANS,
                      fontSize: '13px',
                      fontWeight: 400,
                      color: 'rgba(226,232,240,0.82)',
                      margin: '0 0 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.title}
                  </p>
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: '10px',
                      color: 'rgba(148,163,184,0.5)',
                      margin: 0,
                    }}
                  >
                    {r.publication_year ?? '—'}
                    {r.primary_location?.source?.display_name ? ` · ${r.primary_location.source.display_name}` : ''}
                  </p>
                </button>
              ))}

              <button
                onMouseDown={() => navigate(query)}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px 20px',
                  background: 'rgba(255,255,255,0.04)',
                  border: 'none',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: '10px',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.75)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  View all results for &quot;{query}&quot;
                </span>
                <ArrowRight size={10} style={{ color: 'rgba(255,255,255,0.75)' }} />
              </button>
            </motion.div>
          )}

          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '10px',
                color: 'rgba(148,163,184,0.42)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Research intake across literature and pathway context
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '12px',
                color: 'rgba(148,163,184,0.5)',
              }}
            >
              Start from a paper, or jump straight into the 4-stage launcher.
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="nb-hero-signal-grid"
        >
          {PLATFORM_SIGNALS.map((signal) => (
            <div key={signal.label} className="nb-hero-signal-card">
              <div className="nb-hero-signal-label">{signal.label}</div>
              <div className="nb-hero-signal-value">{signal.value}</div>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="nb-hero-stage-strip"
        >
          {WORKFLOW_BANDS.map((stage) => (
            <Link key={stage.label} href={stage.href} className="nb-hero-stage-card">
              <div className="nb-hero-stage-card__label">{stage.label}</div>
              <div className="nb-hero-stage-card__title">{stage.title}</div>
              <div className="nb-hero-stage-card__detail">{stage.detail}</div>
            </Link>
          ))}
        </motion.div>
      </motion.div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '180px',
          pointerEvents: 'none',
          zIndex: 5,
          background: 'linear-gradient(to bottom, transparent, #0A0D14)',
        }}
      />

      <style jsx>{`
        .nb-hero-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .nb-hero-button {
          min-height: 44px;
          padding: 0 18px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          font-family: ${SANS};
          font-size: 13px;
          font-weight: 600;
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }

        .nb-hero-button:hover,
        .nb-hero-button:focus-visible {
          transform: translateY(-1px);
          outline: none;
        }

        .nb-hero-button--primary {
          background: rgba(255,255,255,0.94);
          border: 1px solid rgba(255,255,255,0.94);
          color: #0f131a;
          box-shadow: 0 16px 36px rgba(0,0,0,0.26);
        }

        .nb-hero-button--primary:hover,
        .nb-hero-button--primary:focus-visible {
          background: #ffffff;
          box-shadow: 0 20px 42px rgba(0,0,0,0.32);
        }

        .nb-hero-button--secondary,
        .nb-hero-button--ghost {
          color: rgba(255,255,255,0.82);
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(14px);
        }

        .nb-hero-button--secondary:hover,
        .nb-hero-button--secondary:focus-visible,
        .nb-hero-button--ghost:hover,
        .nb-hero-button--ghost:focus-visible {
          border-color: rgba(255,255,255,0.28);
          background: rgba(255,255,255,0.09);
          color: #ffffff;
        }

        .nb-hero-search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-family: ${SANS};
          font-size: 15px;
          font-weight: 400;
          color: #e2e8f0;
          min-width: 0;
        }

        .nb-hero-search-input::placeholder {
          color: rgba(148,163,184,0.45);
        }

        .nb-hero-search-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 20px;
          flex-shrink: 0;
          background: ${query.trim() ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'};
          border: 1px solid ${query.trim() ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.08)'};
          color: ${query.trim() ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.22)'};
          font-family: ${MONO};
          font-size: 11px;
          font-weight: 500;
          cursor: ${query.trim() ? 'pointer' : 'default'};
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }

        .nb-hero-search-button:hover,
        .nb-hero-search-button:focus-visible {
          transform: ${query.trim() ? 'translateY(-1px)' : 'none'};
          outline: none;
          background: ${query.trim() ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'};
        }

        .nb-hero-signal-grid {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .nb-hero-signal-card {
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%);
          backdrop-filter: blur(18px);
          padding: 15px 16px;
          display: grid;
          gap: 6px;
          text-align: left;
          box-shadow: 0 14px 34px rgba(0,0,0,0.18);
        }

        .nb-hero-signal-label {
          font-family: ${MONO};
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.36);
        }

        .nb-hero-signal-value {
          font-family: ${SANS};
          font-size: 13px;
          line-height: 1.55;
          color: rgba(255,255,255,0.82);
        }

        .nb-hero-stage-strip {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .nb-hero-stage-card {
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, rgba(15,18,25,0.8) 0%, rgba(15,18,25,0.58) 100%);
          padding: 15px 16px;
          display: grid;
          gap: 6px;
          text-align: left;
          text-decoration: none;
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
          box-shadow: 0 14px 32px rgba(0,0,0,0.18);
        }

        .nb-hero-stage-card:hover,
        .nb-hero-stage-card:focus-visible {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.18);
          background: linear-gradient(180deg, rgba(20,24,33,0.9) 0%, rgba(20,24,33,0.7) 100%);
          box-shadow: 0 18px 38px rgba(0,0,0,0.24);
          outline: none;
        }

        .nb-hero-stage-card__label {
          font-family: ${MONO};
          font-size: 10px;
          color: rgba(255,255,255,0.36);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .nb-hero-stage-card__title {
          font-family: ${SANS};
          font-size: 14px;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          letter-spacing: -0.01em;
        }

        .nb-hero-stage-card__detail {
          font-family: ${SANS};
          font-size: 12px;
          line-height: 1.58;
          color: rgba(226,232,240,0.56);
        }

        @media (max-width: 980px) {
          .nb-hero-signal-grid,
          .nb-hero-stage-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .nb-hero-signal-grid,
          .nb-hero-stage-strip {
            grid-template-columns: minmax(0, 1fr);
          }

          .nb-hero-search-button {
            padding: 8px 14px;
          }
        }

        @media (max-width: 580px) {
          .nb-hero-button {
            width: 100%;
            justify-content: center;
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </header>
  );
}
