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
import { T } from './ide/tokens';
import styles from './Hero.module.css';

const BRAND = T.BRAND;
const SANS  = T.SANS;
const MONO  = T.MONO;

// Quick preview from OpenAlex (CORS-open, no key)
interface PreviewResult {
  id: string;
  title: string;
  publication_year: number | null;
  primary_location?: { source?: { display_name?: string } };
}

export default function Hero() {
  const router       = useRouter();
  const headerRef    = useRef<HTMLElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const fluidRef     = useRef<HeroFluidHandle>(null);
  const [query, setQuery]       = useState('');
  const [focused, setFocused]   = useState(false);
  const [preview, setPreview]   = useState<PreviewResult[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Parallax
  const { scrollY } = useScroll({ target: headerRef, offset: ['start start', 'end start'] });
  const titleY       = useTransform(scrollY, [0, 300], [0, -60]);
  const titleOpacity = useTransform(scrollY, [0, 280], [1, 0]);

  // Debounced OpenAlex preview
  useEffect(() => {
    if (!focused || query.length < 3) { setPreview([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch(
          `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=4&select=id,title,publication_year,primary_location`,
          { signal: ctrl.signal },
        );
        if (!res.ok) return;
        const data = await res.json();
        startTransition(() => setPreview(data.results ?? []));
      } catch { /* aborted */ }
      finally { setPreviewLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query, focused]);

  const onFocus = useCallback(() => {
    setFocused(true);
    fluidRef.current?.triggerConverge();
  }, []);

  const navigate = useCallback((q: string) => {
    const term = q.trim();
    if (term) router.push(`/research?q=${encodeURIComponent(term)}`);
  }, [router]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') navigate(query);
    if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur(); }
  }, [navigate, query]);

  const showPopup = focused && query.length >= 3 && (preview.length > 0 || previewLoading);

  return (
    <header ref={headerRef} className={styles.header}>
      {/* ── Layer 0: B&W Fluid ── */}
      <HeroFluidCanvas ref={fluidRef} />

      {/* ── Layer 1: Content ── */}
      <motion.div
        style={{ y: titleY, opacity: titleOpacity }}
        className={styles.content}>

        {/* Overline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22,1,0.36,1] }}
          className={styles.overline}
          style={{ fontFamily: MONO }}>
          Synthetic Biology Research Platform
        </motion.p>

        {/* ── LCP Element — renders before JS hydration ── */}
        <motion.h1
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, delay: 0.04, ease: [0.22,1,0.36,1] }}
          className={styles.title}
          style={{ fontFamily: BRAND }}>
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
            padding: '0 20px', height: '58px', borderRadius: '20px',
            background: focused ? 'rgba(15,18,25,0.88)' : 'rgba(15,18,25,0.72)',
            border: focused ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.10)',
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
              className={styles.searchInput}
              style={{ fontFamily: SANS }}
              aria-label="Search research database"
              autoComplete="off"
              spellCheck={false}
            />

            {/* Search button */}
            <button
              aria-label="Search"
              onClick={() => navigate(query)}
              className={`${styles.searchButton} ${query.trim() ? styles.searchButtonActive : styles.searchButtonInactive}`}
              style={{ fontFamily: MONO }}>
              {previewLoading
                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                : <ArrowRight size={11} />}
              Search
            </button>
          </div>

          {/* ── Preview Dropdown ── */}
          {showPopup && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className={styles.preview}>
              {previewLoading && preview.length === 0 ? (
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Loader2 size={12} style={{ color: 'rgba(255,255,255,0.75)', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(148,163,184,0.6)' }}>
                    Searching OpenAlex…
                  </span>
                </div>
              ) : preview.map((r) => (
                <button
                  key={r.id}
                  onMouseDown={() => navigate(r.title)}
                  className={styles.previewItem}>
                  <p className={styles.previewTitle} style={{ fontFamily: SANS }}>
                    {r.title}
                  </p>
                  <p className={styles.previewMeta} style={{ fontFamily: MONO }}>
                    {r.publication_year ?? '—'}
                    {r.primary_location?.source?.display_name
                      ? ` · ${r.primary_location.source.display_name}`
                      : ''}
                  </p>
                </button>
              ))}

              {/* Footer: view all */}
              <div className={styles.previewFooter}>
                <button
                  onMouseDown={() => navigate(query)}
                  className={styles.previewFooterButton}
                  style={{ fontFamily: MONO }}>
                  View all results for &ldquo;{query}&rdquo;
                  <ArrowRight size={10} />
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Sub-label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.42 }}
          className={styles.tagline}
          style={{ fontFamily: SANS }}>
          Metabolic pathways<span className={styles.taglineDivider} />Enzyme kinetics<span className={styles.taglineDivider} />Literature synthesis<span className={styles.taglineDivider} />3D visualization
        </motion.p>
      </motion.div>

      {/* ── Bottom fade to bg-base ── */}
      <div className={styles.bottomGradient} />
    </header>
  );
}
