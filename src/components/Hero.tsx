"use client";

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

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Loader2, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { THEME } from "../theme";
import styles from "./Hero.module.css";
import type { HeroFluidHandle } from "./HeroFluidCanvas";

const HeroFluidCanvas = dynamic(() => import("./HeroFluidCanvas"), { ssr: false });

import { getSmartSuggestions, parseSmartInput } from "../lib/smart-parser";

const BRAND = THEME.BRAND;
const SANS = THEME.SANS;
const MONO = THEME.MONO;

// Quick preview from OpenAlex (CORS-open, no key)
interface PreviewResult {
  id: string;
  title: string;
  publication_year: number | null;
  primary_location?: { source?: { display_name?: string } };
}

export default function Hero() {
  const router = useRouter();
  const headerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fluidRef = useRef<HeroFluidHandle>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [preview, setPreview] = useState<PreviewResult[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [smartResult, setSmartResult] = useState<ReturnType<typeof parseSmartInput> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pubchemSuggestions, setPubchemSuggestions] = useState<Array<{ cid: number; name: string }>>([]);
  const [, startTransition] = useTransition();

  // Parallax
  const { scrollY } = useScroll({ target: headerRef, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollY, [0, 300], [0, -60]);
  const titleOpacity = useTransform(scrollY, [0, 280], [1, 0]);

  // Debounced multi-source paper preview (OpenAlex + Semantic Scholar + PubMed)
  useEffect(() => {
    if (!focused || query.length < 3) {
      setPreview([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      const allResults: PreviewResult[] = [];

      // Source 1: OpenAlex
      try {
        const res = await fetch(
          `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=3&select=id,title,publication_year,primary_location`,
          { signal: ctrl.signal },
        );
        if (res.ok) {
          const data = await res.json();
          allResults.push(...(data.results ?? []));
        }
      } catch {
        /* aborted */
      }

      // Source 2: Semantic Scholar
      try {
        const res = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,year,externalIds&limit=3`,
          { signal: ctrl.signal },
        );
        if (res.ok) {
          const data = await res.json();
          for (const p of data.data ?? []) {
            allResults.push({
              id: p.paperId ?? `ss-${Math.random()}`,
              title: p.title ?? "",
              publication_year: p.year ?? null,
              primary_location: { source: { display_name: "Semantic Scholar" } },
            });
          }
        }
      } catch {
        /* aborted */
      }

      // Source 3: PubMed
      try {
        const searchRes = await fetch(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=3&retmode=json`,
          { signal: ctrl.signal },
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const ids = searchData.esearchresult?.idlist ?? [];
          if (ids.length > 0) {
            const summaryRes = await fetch(
              `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`,
              { signal: ctrl.signal },
            );
            if (summaryRes.ok) {
              const summaryData = await summaryRes.json();
              for (const uid of ids) {
                const item = summaryData.result?.[uid];
                if (item) {
                  allResults.push({
                    id: `pmid-${uid}`,
                    title: item.title ?? "",
                    publication_year: item.pubdate ? parseInt(item.pubdate) : null,
                    primary_location: { source: { display_name: item.fulljournalname ?? "PubMed" } },
                  });
                }
              }
            }
          }
        }
      } catch {
        /* aborted */
      }

      // Deduplicate by title similarity and take top 6
      const seen = new Set<string>();
      const deduped = allResults
        .filter((r) => {
          const key = r.title.toLowerCase().slice(0, 50);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 6);

      startTransition(() => setPreview(deduped));
      setPreviewLoading(false);
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, focused]);

  // PubChem autocomplete (debounced)
  useEffect(() => {
    if (!focused || query.trim().length < 3) {
      setPubchemSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pubchem?suggest=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && Array.isArray(data.suggestions)) {
          setPubchemSuggestions(data.suggestions);
        }
      } catch {
        /* aborted */
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, focused]);

  // Smart Entry detection + autocomplete suggestions (sync, no debounce needed)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSmartResult(null);
      setSuggestions([]);
      return;
    }
    try {
      const parsed = parseSmartInput(q);
      setSmartResult(parsed.type !== "FREEFORM" ? parsed : null);
    } catch {
      setSmartResult(null);
    }
    setSuggestions(getSmartSuggestions(q));
  }, [query]);

  const onFocus = useCallback(() => {
    setFocused(true);
    fluidRef.current?.triggerConverge();
  }, []);

  const navigate = useCallback(
    (q: string) => {
      const term = q.trim();
      if (!term) return;
      // Smart Entry: if input matches a known pattern (DOI, strain, molecule, metric),
      // route to /start for goal-driven workflow. Otherwise, route to research search.
      try {
        const parsed = parseSmartInput(term);
        if (parsed.type !== "FREEFORM") {
          router.push(`/start?q=${encodeURIComponent(term)}`);
          return;
        }
      } catch {
        /* empty input — fall through */
      }
      router.push(`/research?q=${encodeURIComponent(term)}`);
    },
    [router],
  );

  const hasSmartResult = smartResult !== null;
  const hasSuggestions = suggestions.length > 0;
  const hasPubchem = pubchemSuggestions.length > 0;
  const showPopup =
    focused &&
    query.length >= 2 &&
    (hasSuggestions || hasPubchem || preview.length > 0 || previewLoading || hasSmartResult);

  // Total dropdown items = smart result + suggestions + pubchem + preview + "View all" footer
  const totalItems = (hasSmartResult ? 1 : 0) + suggestions.length + pubchemSuggestions.length + preview.length + 1;

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setActiveIndex(-1);
        setFocused(false);
        inputRef.current?.blur();
        return;
      }
      if (!showPopup) {
        if (e.key === "Enter") navigate(query);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < preview.length) {
          navigate(preview[activeIndex].title);
        } else {
          navigate(query);
        }
      }
    },
    [navigate, query, showPopup, activeIndex, totalItems, preview],
  );

  // Reset active index when preview results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [preview]);

  return (
    <header ref={headerRef} className={styles.header}>
      {/* ── Layer 0: B&W Fluid ── */}
      <HeroFluidCanvas ref={fluidRef} />

      {/* ── Layer 1: Content ── */}
      <motion.div style={{ y: titleY, opacity: titleOpacity }} className={styles.content}>
        {/* Overline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={styles.overline}
          style={{ fontFamily: MONO }}
        >
          Synthetic Biology Research Platform
        </motion.p>

        {/* ── LCP Element — renders before JS hydration ── */}
        <motion.h1
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          className={styles.title}
          style={{ fontFamily: BRAND }}
        >
          Nexus-Bio
        </motion.h1>

        {/* ── Research Search Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", width: "100%", maxWidth: "660px" }}
        >
          {/* Input wrapper */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "0 20px",
              height: "58px",
              borderRadius: "20px",
              background: focused ? "rgba(15,18,25,0.88)" : "rgba(15,18,25,0.72)",
              border: focused ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(32px) saturate(1.5)",
              WebkitBackdropFilter: "blur(32px) saturate(1.5)",
              boxShadow: focused
                ? "0 0 0 4px rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)"
                : "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
              transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <Search
              size={16}
              style={{
                color: focused ? THEME.INK : THEME.DIM,
                flexShrink: 0,
                transition: "color 0.2s",
              }}
            />

            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={onFocus}
              onBlur={() => setTimeout(() => setFocused(false), 200)}
              onKeyDown={onKeyDown}
              placeholder="Search pathways, enzymes, molecules, or literature…"
              className={styles.searchInput}
              style={{ fontFamily: SANS }}
              aria-label="Search research database"
              aria-autocomplete="list"
              aria-controls="hero-search-listbox"
              aria-activedescendant={activeIndex >= 0 ? `hero-search-option-${activeIndex}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />

            {/* Search button */}
            <button
              aria-label="Search"
              onClick={() => navigate(query)}
              className={`${styles.searchButton} ${query.trim() ? styles.searchButtonActive : styles.searchButtonInactive}`}
              style={{ fontFamily: MONO }}
            >
              {previewLoading ? (
                <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <ArrowRight size={11} />
              )}
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
              className={styles.preview}
              role="listbox"
              id="hero-search-listbox"
              aria-label="Search suggestions"
            >
              {/* Smart Entry result */}
              {hasSmartResult && (
                <button
                  id="hero-search-option-smart"
                  role="option"
                  aria-selected={activeIndex === 0}
                  onMouseDown={() => router.push(`/start?q=${encodeURIComponent(query.trim())}`)}
                  className={styles.previewItem}
                  style={{
                    ...(activeIndex === 0 ? { background: THEME.BORDER } : undefined),
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background:
                          smartResult!.validityClass === "COMPUTATIONAL"
                            ? "rgba(147,203,82,0.15)"
                            : "rgba(232,220,200,0.2)",
                        color: smartResult!.validityClass === "COMPUTATIONAL" ? "#93CB52" : "#E8DCC8",
                        fontSize: "10px",
                        fontWeight: 600,
                        fontFamily: MONO,
                      }}
                    >
                      {smartResult!.type}
                    </span>
                    <span style={{ fontFamily: SANS, fontSize: "13px", color: THEME.VALUE }}>
                      {smartResult!.displayLabel}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "10px",
                        fontFamily: MONO,
                        color: THEME.INK_SOFT,
                      }}
                    >
                      {smartResult!.confidence}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: "11px",
                      color: "rgba(148,163,184,0.5)",
                      marginTop: "2px",
                    }}
                  >
                    {smartResult!.toolChainDescription}
                  </p>
                </button>
              )}
              {/* Autocomplete suggestions from known molecules/strains */}
              {hasSuggestions &&
                suggestions.map((s, i) => {
                  const idx = (hasSmartResult ? 1 : 0) + i;
                  return (
                    <button
                      key={`sug-${s}`}
                      id={`hero-search-option-sug-${i}`}
                      role="option"
                      aria-selected={activeIndex === idx}
                      onMouseDown={() => {
                        setQuery(s);
                        navigate(s);
                      }}
                      className={styles.previewItem}
                      style={activeIndex === idx ? { background: THEME.BORDER } : undefined}
                    >
                      <span style={{ fontFamily: SANS, fontSize: "13px", color: THEME.INK }}>{s}</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "10px",
                          fontFamily: MONO,
                          color: THEME.DIM,
                        }}
                      >
                        ↗
                      </span>
                    </button>
                  );
                })}
              {/* PubChem compound suggestions */}
              {hasPubchem &&
                pubchemSuggestions.map((p, i) => {
                  const idx = (hasSmartResult ? 1 : 0) + suggestions.length + i;
                  return (
                    <button
                      key={`pubchem-${p.cid}`}
                      id={`hero-search-option-pubchem-${i}`}
                      role="option"
                      aria-selected={activeIndex === idx}
                      onMouseDown={() => {
                        setQuery(p.name);
                        navigate(p.name);
                      }}
                      className={styles.previewItem}
                      style={activeIndex === idx ? { background: THEME.BORDER } : undefined}
                    >
                      <span style={{ fontFamily: SANS, fontSize: "13px", color: THEME.INK }}>
                        {p.name}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "10px",
                          fontFamily: MONO,
                          color: THEME.DIM,
                        }}
                      >
                        CID:{p.cid}
                      </span>
                    </button>
                  );
                })}
              {previewLoading && preview.length === 0 ? (
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <Loader2
                    size={12}
                    style={{ color: THEME.INK, animation: "spin 1s linear infinite" }}
                  />
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: "rgba(148,163,184,0.6)" }}>
                    Searching OpenAlex…
                  </span>
                </div>
              ) : (
                preview.map((r, i) => (
                  <button
                    key={r.id}
                    id={`hero-search-option-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={() => navigate(r.title)}
                    className={styles.previewItem}
                    style={i === activeIndex ? { background: THEME.BORDER } : undefined}
                  >
                    <p className={styles.previewTitle} style={{ fontFamily: SANS }}>
                      {r.title}
                    </p>
                    <p className={styles.previewMeta} style={{ fontFamily: MONO }}>
                      {r.publication_year ?? "—"}
                      {r.primary_location?.source?.display_name ? ` · ${r.primary_location.source.display_name}` : ""}
                    </p>
                  </button>
                ))
              )}

              {/* Footer: view all */}
              <div className={styles.previewFooter}>
                <button
                  id={`hero-search-option-${preview.length}`}
                  role="option"
                  aria-selected={activeIndex === preview.length}
                  onMouseDown={() => navigate(query)}
                  className={styles.previewFooterButton}
                  style={{
                    fontFamily: MONO,
                    ...(activeIndex === preview.length ? { background: THEME.BORDER } : undefined),
                  }}
                >
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
          style={{ fontFamily: SANS }}
        >
          Metabolic pathways
          <span className={styles.taglineDivider} />
          Enzyme kinetics
          <span className={styles.taglineDivider} />
          Literature synthesis
          <span className={styles.taglineDivider} />
          3D visualization
        </motion.p>
      </motion.div>

      {/* ── Bottom fade to bg-base ── */}
      <div className={styles.bottomGradient} />
    </header>
  );
}
