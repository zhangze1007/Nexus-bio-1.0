'use client';
/**
 * CodonOptimizerPanel — Reusable codon optimization UI for CATDES and ProEvol.
 *
 * Wraps `optimizeCodons` from `src/server/codonOptimizer.ts`.
 * Inputs: amino acid sequence, organism selector, restriction sites to avoid.
 * Outputs: optimized DNA sequence, CAI score, GC content bar.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { THEME } from '../../../theme';
import { optimizeCodons } from '../../../server/codonOptimizer';
import type { Organism, CodonOptimizationResult } from '../../../server/codonOptimizer';
import MetricCard from '../../ide/shared/MetricCard';

/* ── Types ──────────────────────────────────────────────────────────────── */

export type { CodonOptimizationResult };

export interface CodonOptimizerPanelProps {
  /** One-letter amino acid sequence (e.g. "MKTAYIAKQRQFERNL"). */
  aminoAcidSequence: string;
  /** Called when optimization completes successfully. */
  onOptimized?: (result: CodonOptimizationResult) => void;
}

/* ── Organism presets ───────────────────────────────────────────────────── */

const ORGANISMS: { value: Organism; label: string }[] = [
  { value: 'ecoli', label: 'E. coli' },
  { value: 'scerevisiae', label: 'S. cerevisiae' },
];

/* ── Common restriction sites (defaults) ────────────────────────────────── */

const COMMON_SITES = [
  { name: 'EcoRI', seq: 'GAATTC' },
  { name: 'BamHI', seq: 'GGATCC' },
  { name: 'HindIII', seq: 'AAGCTT' },
  { name: 'XbaI', seq: 'TCTAGA' },
  { name: 'SpeI', seq: 'ACTAGT' },
  { name: 'NotI', seq: 'GCGGCCGC' },
];

/* ── Style helpers ──────────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  fontFamily: THEME.MONO,
  fontSize: THEME.FS_XS,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: THEME.LABEL,
  marginBottom: 4,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: THEME.R_SM,
  border: `1px solid ${THEME.BORDER}`,
  background: THEME.PANEL_INSET,
  color: THEME.VALUE,
  fontFamily: THEME.MONO,
  fontSize: THEME.FS_SM,
  outline: 'none',
  transition: 'border-color 120ms',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none' as const,
  backgroundImage:
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%239BA3AE' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 28,
};

const monoSequence: React.CSSProperties = {
  fontFamily: THEME.MONO,
  fontSize: THEME.FS_SM,
  lineHeight: 1.6,
  color: THEME.VALUE,
  wordBreak: 'break-all' as const,
  whiteSpace: 'pre-wrap',
  letterSpacing: '0.04em',
};

/* ── GC bar component ───────────────────────────────────────────────────── */

function GCBar({ gc }: { gc: number }) {
  const pct = Math.round(gc * 100);
  const barColor =
    gc >= 0.4 && gc <= 0.6
      ? THEME.MINT
      : gc >= 0.35 && gc <= 0.65
        ? THEME.APRICOT
        : THEME.CORAL;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: barColor,
            transition: 'width 300ms ease',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_SM,
          color: barColor,
          fontWeight: 600,
          minWidth: 42,
          textAlign: 'right' as const,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function CodonOptimizerPanel({
  aminoAcidSequence,
  onOptimized,
}: CodonOptimizerPanelProps) {
  const [organism, setOrganism] = useState<Organism>('ecoli');
  const [restrictionInput, setRestrictionInput] = useState('');
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [result, setResult] = useState<CodonOptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [copied, setCopied] = useState(false);

  /* Toggle a common restriction site */
  const toggleSite = useCallback((seq: string) => {
    setSelectedSites((prev) =>
      prev.includes(seq) ? prev.filter((s) => s !== seq) : [...prev, seq],
    );
  }, []);

  /* Parse all restriction sites (selected checkboxes + manual comma-separated) */
  const allSites = useMemo(() => {
    const manual = restrictionInput
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[ACGT]+$/.test(s) && s.length >= 4);
    return [...new Set([...selectedSites, ...manual])];
  }, [selectedSites, restrictionInput]);

  /* Run optimization */
  const handleOptimize = useCallback(() => {
    const seq = aminoAcidSequence.trim().toUpperCase();
    if (!seq) {
      setError('Enter an amino acid sequence.');
      return;
    }
    if (!/^[ACDEFGHIKLMNPQRSTVWY]+$/.test(seq)) {
      setError('Sequence contains invalid amino acid characters.');
      return;
    }

    setOptimizing(true);
    setError(null);
    setResult(null);

    // Run synchronously (the engine is fast for typical sequences < 500 aa)
    try {
      const res = optimizeCodons(seq, {
        organism,
        avoidSites: allSites,
      });
      setResult(res);
      onOptimized?.(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Optimization failed.');
    } finally {
      setOptimizing(false);
    }
  }, [aminoAcidSequence, organism, allSites, onOptimized]);

  /* Copy DNA to clipboard */
  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.dnaSequence);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard API may be blocked */
    }
  }, [result]);

  const seqLen = aminoAcidSequence.trim().length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
        borderRadius: THEME.R_MD,
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_INSET,
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_SM,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: THEME.LILAC,
          }}
        >
          Codon Optimizer
        </span>
        {seqLen > 0 && (
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: THEME.DIM,
            }}
          >
            {seqLen} aa
          </span>
        )}
      </div>

      {/* ── Input summary ── */}
      <div
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          color: THEME.DIM,
          background: 'rgba(0,0,0,0.25)',
          padding: '6px 8px',
          borderRadius: THEME.R_SM,
          wordBreak: 'break-all' as const,
          maxHeight: 48,
          overflow: 'hidden',
          lineHeight: 1.5,
        }}
      >
        {aminoAcidSequence.trim() || 'No sequence provided'}
      </div>

      {/* ── Organism selector ── */}
      <div>
        <label style={labelStyle}>Target Organism</label>
        <select
          value={organism}
          onChange={(e) => setOrganism(e.target.value as Organism)}
          style={selectStyle}
        >
          {ORGANISMS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Restriction sites ── */}
      <div>
        <label style={labelStyle}>Avoid Restriction Sites</label>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 8,
          }}
        >
          {COMMON_SITES.map((site) => {
            const active = selectedSites.includes(site.seq);
            return (
              <button
                key={site.seq}
                type="button"
                onClick={() => toggleSite(site.seq)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 999,
                  border: `1px solid ${active ? THEME.LILAC : THEME.BORDER}`,
                  background: active
                    ? 'rgba(207,196,227,0.14)'
                    : 'rgba(255,255,255,0.02)',
                  color: active ? THEME.LILAC : THEME.DIM,
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_XS,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
              >
                {site.name}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="Custom sites: GAATTC, GGATCC ..."
          value={restrictionInput}
          onChange={(e) => setRestrictionInput(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* ── Optimize button ── */}
      <button
        type="button"
        onClick={handleOptimize}
        disabled={optimizing || !aminoAcidSequence.trim()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height: 36,
          padding: '0 16px',
          borderRadius: THEME.R_MD,
          border: 'none',
          background: optimizing ? 'rgba(191,220,205,0.3)' : THEME.MINT,
          color: '#0a0a0a',
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_SM,
          fontWeight: 600,
          cursor: optimizing || !aminoAcidSequence.trim() ? 'not-allowed' : 'pointer',
          opacity: optimizing || !aminoAcidSequence.trim() ? 0.5 : 1,
          transition: 'background 100ms, opacity 100ms',
        }}
      >
        {optimizing ? 'Optimizing...' : 'Optimize Codons'}
      </button>

      {/* ── Error ── */}
      {error && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: THEME.R_SM,
            background: 'rgba(232,163,161,0.1)',
            border: `1px solid rgba(232,163,161,0.25)`,
            color: THEME.CORAL,
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingTop: 4,
            borderTop: `1px solid ${THEME.BORDER}`,
          }}
        >
          {/* Metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MetricCard
              label="CAI Score"
              value={result.cai.toFixed(4)}
              size="sm"
              accent={result.cai >= 0.8 ? THEME.MINT : result.cai >= 0.6 ? THEME.APRICOT : THEME.CORAL}
              detail={result.cai >= 0.8 ? 'High expression' : result.cai >= 0.6 ? 'Moderate' : 'Low'}
            />
            <MetricCard
              label="Sequence"
              value={`${(result.dnaSequence.length / 3).toFixed(0)} codons`}
              size="sm"
              accent={THEME.SKY}
              detail={`${result.dnaSequence.length} bp`}
            />
          </div>

          {/* GC content */}
          <div>
            <span style={labelStyle}>GC Content</span>
            <GCBar gc={result.gcContent} />
          </div>

          {/* Restriction site warnings */}
          {result.restrictionSitesFound.length > 0 && (
            <div
              style={{
                padding: '6px 8px',
                borderRadius: THEME.R_SM,
                background: 'rgba(229,143,70,0.08)',
                border: `1px solid rgba(229,143,70,0.2)`,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: THEME.RISK_MEDIUM,
              }}
            >
              Warning: {result.restrictionSitesFound.length} restriction site(s) remain: {result.restrictionSitesFound.join(', ')}
            </div>
          )}

          {/* DNA sequence */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span style={labelStyle}>Optimized DNA (5&apos;&rarr;3&apos;)</span>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: THEME.R_SM,
                  border: `1px solid ${THEME.BORDER}`,
                  background: copied ? 'rgba(191,220,205,0.14)' : 'rgba(255,255,255,0.02)',
                  color: copied ? THEME.MINT : THEME.DIM,
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_XS,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div
              style={{
                maxHeight: 160,
                overflowY: 'auto',
                padding: '8px 10px',
                borderRadius: THEME.R_SM,
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${THEME.BORDER}`,
              }}
            >
              <code style={monoSequence}>{result.dnaSequence}</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
