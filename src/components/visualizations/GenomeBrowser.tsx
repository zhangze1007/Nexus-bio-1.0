'use client';

/**
 * GenomeBrowser — interactive genome visualization powered by IGV.js.
 *
 * Wraps the igv.js library to provide a dark-themed, embeddable genome browser
 * with support for custom annotation tracks (CRISPR targets, knockouts, genes).
 *
 * Features:
 * - E. coli K-12 reference genome pre-configured
 * - Dark theme matching Nexus-Bio design system
 * - Custom BED/GFF annotation tracks
 * - Region selection callback for downstream tools
 * - Responsive height
 *
 * Usage:
 * ```tsx
 * <GenomeBrowser
 *   genome="ecoli_K12_MG1655"
 *   locus="chr:1000000-1100000"
 *   tracks={[crisprTrack, knockoutTrack]}
 *   onRegionSelect={(r) => console.log(r)}
 * />
 * ```
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { THEME } from '../../theme';

// ── Public types ────────────────────────────────────────────────────────────

export interface GenomeBrowserTrack {
  /** Display name for the track */
  name: string;
  /** Track type */
  type: 'annotation' | 'sequence' | 'wig' | 'alignment';
  /** File format */
  format: 'bed' | 'gff' | 'gtf' | 'bam' | 'bigwig';
  /** Remote track URL (mutually exclusive with features) */
  url?: string;
  /** Inline BED-format features (mutually exclusive with url) */
  features?: Array<{
    chr: string;
    start: number;
    end: number;
    name?: string;
    score?: number;
    strand?: '+' | '-';
    color?: string;
    description?: string;
  }>;
}

/** Alias for backward compatibility with track builders */
export type GenomeTrack = GenomeBrowserTrack;

export interface GenomeBrowserProps {
  /** Reference genome identifier or custom genome definition */
  genome: string;
  /** Initial locus to display (e.g., 'chr:1000000-1100000') */
  locus?: string;
  /** Custom tracks to overlay on the genome */
  tracks?: GenomeBrowserTrack[];
  /** Height of the browser in pixels */
  height?: number;
  /** Callback when user selects a genomic region */
  onRegionSelect?: (region: { chr: string; start: number; end: number }) => void;
}

// ── IGV type stub ───────────────────────────────────────────────────────────
// Minimal type for the igv module to avoid `any` everywhere

interface IGVBrowser {
  currentLoci(): string[] | string;
  loadTrack(track: Record<string, unknown>): Promise<unknown>;
  search(query: string): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string): void;
}

interface IGVModule {
  createBrowser: (div: HTMLElement, options: Record<string, unknown>) => Promise<IGVBrowser>;
  removeBrowser: (browser: IGVBrowser) => void;
  setDefaults: (config: Record<string, unknown>) => void;
}

// ── Custom genome definitions ───────────────────────────────────────────────

const CUSTOM_GENOMES: Record<string, Record<string, unknown>> = {
  ecoli_K12_MG1655: {
    id: 'ecoli_K12_MG1655',
    name: 'E. coli K-12 MG1655',
    fastaURL: 'https://hgdownload.soe.ucsc.edu/goldenPath/ecK12/dna/ecK12.fa.gz',
    indexURL: 'https://hgdownload.soe.ucsc.edu/goldenPath/ecK12/dna/ecK12.fa.gz.fai',
    chromosomeOrder: ['chr'],
  },
};

// ── Component ───────────────────────────────────────────────────────────────

export function GenomeBrowser({
  genome,
  locus,
  tracks,
  height = 400,
  onRegionSelect,
}: GenomeBrowserProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const browserRef = useRef<IGVBrowser | null>(null);
  const igvRef = useRef<IGVModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Store latest callback in a ref to avoid re-creating the browser on callback change
  const onRegionSelectRef = useRef(onRegionSelect);
  onRegionSelectRef.current = onRegionSelect;

  /**
   * Initialize IGV.js browser on mount.
   */
  const initBrowser = useCallback(async () => {
    if (!containerRef.current) return;

    setLoading(true);
    setError(null);

    try {
      // Dynamic import — IGV.js accesses window/document, must run client-side
      const igv = (await import('igv').then((m) => m.default ?? m)) as unknown as IGVModule;
      igvRef.current = igv;

      // Configure dark theme defaults
      igv.setDefaults({
        showCircularView: false,
        showCircularViewButton: false,
        showTrackLabelButton: true,
        showTrackLabels: true,
        showCursorTrackingGuideButton: true,
        showCursorTrackingGuide: true,
        showCenterGuideButton: false,
        showCenterGuide: false,
        showSampleNames: false,
        showSVGButton: false,
      });

      // Build browser configuration
      const genomeConfig = CUSTOM_GENOMES[genome] ?? genome;

      const options: Record<string, unknown> = {
        reference: genomeConfig,
        locus: locus ?? (genome.startsWith('ecoli') ? 'chr:0-100000' : undefined),
        tracks: tracks?.map((t) => ({
          name: t.name,
          type: t.type,
          format: t.format,
          url: t.url,
          features: t.features,
          color: t.features?.[0]?.color,
          height: 100,
          autoHeight: false,
          displayMode: 'EXPANDED',
        })) ?? [],
        showNavigation: true,
        showRuler: true,
      };

      // Clean up existing browser if re-initializing
      if (browserRef.current) {
        igv.removeBrowser(browserRef.current);
        browserRef.current = null;
      }

      // Clear container
      containerRef.current.innerHTML = '';

      // Create browser
      const browser = await igv.createBrowser(containerRef.current, options);
      browserRef.current = browser;

      // Register locus change handler for region selection
      if (onRegionSelectRef.current) {
        browser.on('locuschange', (...args: unknown[]) => {
          const loci = args[0] as Array<{ chr: string; start: number; end: number; getLocusString: () => string }> | undefined;
          if (loci && loci.length > 0 && onRegionSelectRef.current) {
            onRegionSelectRef.current({
              chr: loci[0].chr,
              start: loci[0].start,
              end: loci[0].end,
            });
          }
        });
      }

      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize genome browser';
      setError(message);
      setLoading(false);
    }
  }, [genome, locus]);

  // Initialize on mount and when genome/locus changes
  useEffect(() => {
    initBrowser();

    return () => {
      // Cleanup on unmount
      if (browserRef.current && igvRef.current) {
        try {
          igvRef.current.removeBrowser(browserRef.current);
        } catch {
          // Ignore cleanup errors
        }
        browserRef.current = null;
      }
    };
  }, [initBrowser]);

  /**
   * Load additional tracks dynamically.
   */
  useEffect(() => {
    if (!browserRef.current || !tracks || tracks.length === 0) return;

    // Load any tracks that weren't in the initial config
    for (const track of tracks) {
      browserRef.current.loadTrack({
        name: track.name,
        type: track.type,
        format: track.format,
        url: track.url,
        features: track.features,
        color: track.features?.[0]?.color,
        height: 100,
        autoHeight: false,
        displayMode: 'EXPANDED',
      }).catch(() => {
        // Track may already exist — ignore duplicate load errors
      });
    }
  }, [tracks]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        minHeight: 200,
        borderRadius: THEME.R_SM,
        overflow: 'hidden',
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.BG_CANVAS,
      }}
    >
      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(5, 5, 5, 0.85)',
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              color: THEME.DIM,
              letterSpacing: '0.05em',
            }}
          >
            Loading genome browser...
          </span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            padding: '8px 12px',
            background: 'rgba(217, 101, 98, 0.15)',
            border: `1px solid ${THEME.RISK_HIGH}`,
            borderRadius: THEME.R_SM,
            zIndex: 20,
          }}
        >
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              color: THEME.RISK_HIGH,
            }}
          >
            {error}
          </span>
        </div>
      )}

      {/* IGV.js container — this is where the browser renders */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      {/* IGV.js dark theme overrides — injected via style tag */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Override IGV.js light theme to match Nexus-Bio dark palette */
        .igv-container,
        .igv-root-div,
        .igv-content-header,
        .igv-track-container,
        .igv-track-div,
        .igv-nav-bar,
        .igv-nav-bar-button,
        .igv-locus-size-group {
          background-color: ${THEME.BG_CANVAS} !important;
          color: ${THEME.VALUE} !important;
        }
        .igv-nav-bar {
          background-color: ${THEME.BG_PANEL} !important;
          border-bottom: 1px solid ${THEME.BORDER} !important;
        }
        .igv-nav-bar-button {
          background-color: ${THEME.PANEL_STRONG} !important;
          border: 1px solid ${THEME.BORDER} !important;
          border-radius: ${THEME.R_SM} !important;
          color: ${THEME.VALUE} !important;
        }
        .igv-nav-bar-button:hover {
          background-color: ${THEME.PANEL_INSET} !important;
          border-color: ${THEME.BORDER_ACTIVE} !important;
        }
        .igv-track-label {
          background-color: ${THEME.BG_PANEL} !important;
          color: ${THEME.VALUE} !important;
          font-family: ${THEME.SANS} !important;
          font-size: ${THEME.FS_SM} !important;
          border: 1px solid ${THEME.BORDER} !important;
        }
        .igv-track-name {
          color: ${THEME.VALUE} !important;
          font-family: ${THEME.SANS} !important;
        }
        .igv-ruler-track,
        .igv-ruler-sweeper-div {
          background-color: ${THEME.BG_CANVAS} !important;
        }
        .igv-ruler-tic-mark,
        .igv-ruler-tic-label {
          color: ${THEME.DIM} !important;
        }
        .igv-viewport-content-div {
          background-color: ${THEME.BG_CANVAS} !important;
        }
        .igv-whole-genome-container,
        .igv-whole-genome-shim {
          background-color: ${THEME.BG_CANVAS} !important;
        }
        .igv-generic-dialog {
          background-color: ${THEME.PANEL_STRONG} !important;
          border: 1px solid ${THEME.BORDER} !important;
          color: ${THEME.VALUE} !important;
        }
        .igv-generic-dialog-header {
          background-color: ${THEME.BG_PANEL} !important;
          color: ${THEME.VALUE} !important;
        }
        .igv-generic-dialog input,
        .igv-generic-dialog select {
          background-color: ${THEME.INPUT_BG} !important;
          color: ${THEME.INPUT_TEXT} !important;
          border: 1px solid ${THEME.INPUT_BORDER} !important;
        }
        .igv-popover {
          background-color: ${THEME.PANEL_STRONG} !important;
          border: 1px solid ${THEME.BORDER} !important;
          color: ${THEME.VALUE} !important;
          font-family: ${THEME.SANS} !important;
          box-shadow: ${THEME.SHADOW_HIGH} !important;
        }
        .igv-popover-track-popup-body {
          color: ${THEME.VALUE} !important;
        }
        .igv-popover-track-popup-header {
          background-color: ${THEME.BG_PANEL} !important;
          color: ${THEME.VALUE} !important;
        }
        .igv-karyo-div {
          background-color: ${THEME.BG_CANVAS} !important;
        }
        .igv-ideogram {
          background-color: ${THEME.BG_CANVAS} !important;
        }
        .igv-search-input {
          background-color: ${THEME.INPUT_BG} !important;
          color: ${THEME.INPUT_TEXT} !important;
          border: 1px solid ${THEME.INPUT_BORDER} !important;
          font-family: ${THEME.MONO} !important;
        }
        .igv-zoom-widget {
          background-color: transparent !important;
        }
        .igv-zoom-widget svg line,
        .igv-zoom-widget svg rect {
          stroke: ${THEME.DIM} !important;
        }
        .igv-cursor-tracking-guide {
          background-color: rgba(175, 195, 214, 0.15) !important;
        }
        .igv-center-guide {
          background-color: rgba(175, 195, 214, 0.15) !important;
        }
      ` }} />
    </div>
  );
}

export default GenomeBrowser;
