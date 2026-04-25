'use client';
/**
 * Hero — xAI-minimal redesign.
 *
 * Structure:
 *   · HeroFluidCanvas — full-section B&W grainy fluid (z=0)
 *   · Centered layer  — massive "Nexus-Bio" + Research Search Bar (z=10)
 *   · Bottom vignette — blends into dark bg below
 *
 * Search bar interactions:
 *   · Focus   → fluid.triggerConverge() (8 inward velocity splats)
 *   · Typing  → debounced OpenAlex preview (4 results, glassmorphism popup)
 *   · Enter   → router.push('/research?q=...')
 *   · Scroll parallax on title
 *
 * LCP: "Nexus-Bio" h1 is static HTML — renders on first paint before any JS.
 */

import {
  useRef, useState, useEffect, useCallback, useTransition,
} from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Search, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import HeroFluidCanvas, { type HeroFluidHandle } from './HeroFluidCanvas';

const BRAND = "'Space Grotesk',-apple-system,sans-serif";
const SANS  = "'Inter',-apple-system,sans-serif";
const MONO  = "'JetBrains Mono','Fira Code',monospace";

// Quick preview from OpenAlex (CORS-open, no key)
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

// ── Reveal helper ─────────────────────────────────────────────────────
export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
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

  // Scroll-based parallax on title
  const { scrollYProgress } = useScroll({
    target: headerRef,
    offset: ['start start', 'end start'],
  });
  const titleY       = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  // Debounced preview fetch
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
  }, [query]);

  const navigate = useCallback((q: string) => {
    if (q.trim()) router.push(`/research?q=${encodeURIComponent(q.trim())}`);
  }, [router]);

  const onFocus = useCallback(() => {
    setFocused(true);
    fluidRef.current?.triggerConverge();
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') navigate(query);
    if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur(); }
  }, [navigate, query]);

  const showPopup = focused && query.length >= 3 && (preview.length > 0 || previewLoading);

  return (
    <header ref={headerRef} style={{
      position: 'relative',
      width: '100%',
      height: '100svh',
      minHeight: '600px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* ── Layer 0: B&W Fluid ── */}
      <HeroFluidCanvas ref={fluidRef} />

      {/* ── Layer 1: Content ── */}
      <motion.div
        style={{
          y: titleY, opacity: titleOpacity,
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center',
          padding: '0 clamp(20px, 5vw, 60px)',
          width: '100%', maxWidth: '900px',
          pointerEvents: 'auto',
        }}>

        {/* Overline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22,1,0.36,1] }}
          style={{
            fontFamily: MONO, fontSize: '10px', fontWeight: 500,
            textTransform: 'uppercase', letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.35)',
            margin: '0 0 28px',
          }}>
          Synthetic Biology Research Platform
        </motion.p>

        {/* ── LCP Element — renders before JS hydration ── */}
        <motion.h1
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, delay: 0.04, ease: [0.22,1,0.36,1] }}
          style={{
            fontWeight: 700, fontStyle: 'normal',
            fontSize: 'clamp(4rem, 11vw, 9.5rem)',
            lineHeight: 0.95, letterSpacing: '-0.03em',
            fontFamily: BRAND,
            color: '#FFFFFF',
            margin: '0 0 clamp(32px, 5vw, 56px)',
            textShadow: '0 0 120px rgba(255,255,255,0.06)',
          }}>
          Nexus-Bio
        </motion.h1>

        {/* ── Research Search Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.18, ease: [0.22,1,0.36,1] }}
          style={{ position: 'relative', width: '100%', maxWidth: '660px' }}>

          {/* Input wrapper */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '0 20px', height: '58px', borderRadius: '30px',
            background: focused
              ? 'rgba(15,18,25,0.88)'
              : 'rgba(15,18,25,0.72)',
            border: focused
              ? '1px solid rgba(255,255,255,0.3)'
              : '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(32px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
            boxShadow: focused
              ? '0 0 0 4px rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
            transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
          }}>
            <Search size={16} style={{
              color: focused ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)',
              flexShrink: 0, transition: 'color 0.2s',
            }} />

            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={onFocus}
              onBlur={() => setTimeout(() => setFocused(false), 200)}
              onKeyDown={onKeyDown}
              placeholder="Search pathways, enzymes, literature…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: SANS, fontSize: '15px', fontWeight: 400,
                color: '#E2E8F0',
                '::placeholder': { color: 'rgba(148,163,184,0.45)' },
              } as React.CSSProperties}
              aria-label="Search research database"
              autoComplete="off"
              spellCheck={false}
            />

            {/* Search button */}
            <button
              onClick={() => navigate(query)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '20px', flexShrink: 0,
                background: query.trim()
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(255,255,255,0.04)',
                border: query.trim()
                  ? '1px solid rgba(255,255,255,0.25)'
                  : '1px solid rgba(255,255,255,0.07)',
                color: query.trim() ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)',
                fontFamily: MONO, fontSize: '11px', fontWeight: 500,
                cursor: query.trim() ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}>
              {previewLoading
                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                : <ArrowRight size={11} />}
              Search
            </button>
          </div>

          {/* ── Preview Dropdown (Glassmorphism 2.0) ── */}
          {showPopup && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              style={{
                position: 'absolute', top: 'calc(100% + 8px)',
                left: 0, right: 0, zIndex: 50,
                borderRadius: '18px',
                background: 'rgba(10,13,20,0.94)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(40px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
                overflow: 'hidden',
              }}>
              {previewLoading && preview.length === 0 ? (
                <div style={{ padding: '16px 20px', display:'flex', alignItems:'center', gap:'10px' }}>
                  <Loader2 size={12} style={{ color:'rgba(255,255,255,0.75)', animation:'spin 1s linear infinite' }} />
                  <span style={{ fontFamily:MONO, fontSize:'11px', color:'rgba(148,163,184,0.6)' }}>
                    Searching OpenAlex…
                  </span>
                </div>
              ) : preview.map((r, i) => (
                <button
                  key={r.id}
                  onMouseDown={() => navigate(r.title)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '12px 20px', background: 'none', border: 'none',
                    cursor: 'pointer',
                    borderBottom: i < preview.length - 1
                      ? '1px solid rgba(255,255,255,0.04)'
                      : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}>
                  <p style={{
                    fontFamily: SANS, fontSize: '13px', fontWeight: 400,
                    color: 'rgba(226,232,240,0.82)',
                    margin: '0 0 4px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.title}
                  </p>
                  <p style={{
                    fontFamily: MONO, fontSize: '10px',
                    color: 'rgba(148,163,184,0.5)',
                    margin: 0,
                  }}>
                    {r.publication_year ?? '—'}
                    {r.primary_location?.source?.display_name
                      ? ` · ${r.primary_location.source.display_name}`
                      : ''}
                  </p>
                </button>
              ))}

              {/* Footer: view all */}
              <button
                onMouseDown={() => navigate(query)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', width: '100%', padding: '12px 20px',
                  background: 'rgba(255,255,255,0.04)', border: 'none',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}>
                <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  View all results for "{query}"
                </span>
                <ArrowRight size={10} style={{ color: 'rgba(255,255,255,0.75)' }} />
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* Sub-label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.42 }}
          style={{
            fontFamily: SANS, fontSize: '13px',
            color: 'rgba(148,163,184,0.4)',
            margin: 'clamp(16px, 2vw, 24px) 0 0',
            letterSpacing: '0.01em',
          }}>
          Metabolic pathways · Enzyme kinetics · Literature synthesis · 3D visualization
        </motion.p>
      </motion.div>

      {/* ── Bottom fade to bg-base ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '160px', pointerEvents: 'none', zIndex: 5,
        background: 'linear-gradient(to bottom, transparent, #0A0D14)',
      }} />

      {/* ── Spin keyframe (for Loader2) ── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </header>
  );
}
