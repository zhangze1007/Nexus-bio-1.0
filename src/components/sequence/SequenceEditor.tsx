'use client';

/**
 * Sequence Editor
 *
 * Main sequence editor component combining:
 * - Toolbar (zoom, search, topology toggle, export)
 * - Feature annotation bar
 * - Linear sequence viewer (Canvas)
 * - Circular plasmid map (SVG, for circular topology)
 * - Sidebar: selected feature details, restriction enzyme list
 */

import React, { useState, useMemo, useCallback } from 'react';
import { THEME } from '../../theme';
import type { SequenceData, SequenceFeature } from './types';
import { createSequenceData } from './types';
import { FEATURE_COLORS } from './colors';
import { findRestrictionSites } from './restrictionEnzymes';
import { sixFrameTranslation } from './translation';
import FeatureAnnotation from './FeatureAnnotation';
import LinearSequenceViewer from './LinearSequenceViewer';
import CircularPlasmidView from './CircularPlasmidView';

interface SequenceEditorProps {
  initialData?: SequenceData;
}

/** Demo sequence: partial artemisinin biosynthesis operon */
const DEMO_SEQUENCE = createSequenceData({
  name: 'pNexus-Artemisinin',
  sequence:
    'TTGACAGCTAGCTCAGTCCTAGGTATAATGCTAGCGATGAAATTTGGGTAGAATTCAGAATTCAAGCTTGCA' +
    'GATATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGGATCCGATCGATCGATCGATCGATC' +
    'GATCGATCGATCGATCGATCGATCGATCGATCTGCAGGATCGATCGATCGATCGATCGATCGATCGATCGAT' +
    'CGATCGATCGATCGATCGATCCCGGGGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGA' +
    'TCGATCGATCGATCGATCGATCGATCGATCGATCGAGATCTGATCGATCGATCGATCGATCGATCGATCGAT' +
    'CGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGAT' +
    'CGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGGTCGACGATCGATC',
  type: 'dna',
  topology: 'circular',
  features: [
    { id: 'promoter', type: 'promoter', start: 0, end: 35, strand: 1, name: 'Ptac', color: FEATURE_COLORS.promoter, notes: 'IPTG-inducible promoter' },
    { id: 'rbs', type: 'RBS', start: 36, end: 50, strand: 1, name: 'RBS', color: FEATURE_COLORS.RBS },
    { id: 'cds1', type: 'CDS', start: 50, end: 200, strand: 1, name: 'ADS', color: FEATURE_COLORS.CDS, notes: 'Amorpha-4,11-diene synthase' },
    { id: 'cds2', type: 'CDS', start: 220, end: 450, strand: 1, name: 'CYP71AV1', color: FEATURE_COLORS.CDS, notes: 'Cytochrome P450 monooxygenase' },
    { id: 'term', type: 'terminator', start: 460, end: 500, strand: 1, name: 'T7term', color: FEATURE_COLORS.terminator },
    { id: 'primer-fwd', type: 'primer', start: 0, end: 20, strand: 1, name: 'Fwd', color: FEATURE_COLORS.primer },
  ],
});

export default function SequenceEditor({ initialData }: SequenceEditorProps) {
  const [data, setData] = useState<SequenceData>(initialData ?? DEMO_SEQUENCE);
  const [zoom, setZoom] = useState<1 | 2 | 4>(1);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'features' | 'enzymes' | 'info'>('features');
  const [scrollLeft, setScrollLeft] = useState(0);

  // Find restriction sites
  const restrictionSites = useMemo(() => findRestrictionSites(data.sequence), [data.sequence]);

  // Six-frame translation
  const translation = useMemo(() => {
    if (data.type !== 'dna') return null;
    return sixFrameTranslation(data.sequence);
  }, [data.sequence, data.type]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const upper = searchQuery.toUpperCase();
    const results: number[] = [];
    let idx = data.sequence.indexOf(upper);
    while (idx !== -1) {
      results.push(idx);
      idx = data.sequence.indexOf(upper, idx + 1);
    }
    return results.slice(0, 50); // cap at 50
  }, [data.sequence, searchQuery]);

  // Selected feature
  const selectedFeature = selectedFeatureId
    ? data.features.find((f) => f.id === selectedFeatureId)
    : null;

  // Selection info
  const selectionInfo = useMemo(() => {
    if (!selectedRange) return null;
    const subseq = data.sequence.slice(selectedRange.start, selectedRange.end);
    const gc =
      data.type !== 'protein'
        ? ((subseq.match(/[GC]/gi)?.length ?? 0) / subseq.length * 100).toFixed(1)
        : null;
    return {
      start: selectedRange.start + 1,
      end: selectedRange.end,
      length: subseq.length,
      sequence: subseq,
      gc,
    };
  }, [selectedRange, data.sequence, data.type]);

  // Topology toggle
  const toggleTopology = useCallback(() => {
    setData((prev) => ({ ...prev, topology: prev.topology === 'circular' ? 'linear' : 'circular' }));
  }, []);

  // Export FASTA
  const handleExport = useCallback(() => {
    const fasta = `>${data.name} ${data.length} bp\n${data.sequence.replace(/(.{60})/g, '$1\n')}`;
    const blob = new Blob([fasta], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.name.replace(/\s+/g, '_')}.fasta`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  // Handle paste/input of new sequence
  const handleNewSequence = useCallback((seq: string, name?: string) => {
    setData(createSequenceData({ sequence: seq, name: name ?? 'Imported' }));
    setSelectedRange(null);
    setSelectedFeatureId(null);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: THEME.BG_SHELL,
        color: THEME.VALUE,
        fontFamily: THEME.SANS,
        fontSize: 13,
      }}
    >
      {/* ── Toolbar ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: THEME.BG_PANEL,
          borderBottom: `1px solid ${THEME.BORDER}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: THEME.BRAND, fontWeight: 600, fontSize: 14 }}>
          {data.name}
        </span>
        <span style={{ color: THEME.DIM, fontFamily: THEME.MONO, fontSize: 11 }}>
          {data.length.toLocaleString()} bp &middot; {data.topology}
        </span>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <input
          type="text"
          placeholder="Search sequence..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: 180,
            padding: '4px 8px',
            background: THEME.INPUT_BG,
            border: `1px solid ${THEME.INPUT_BORDER}`,
            borderRadius: THEME.R_SM,
            color: THEME.INPUT_TEXT,
            fontFamily: THEME.MONO,
            fontSize: 11,
            outline: 'none',
          }}
        />
        {searchResults.length > 0 && (
          <span style={{ color: THEME.DIM, fontSize: 10, fontFamily: THEME.MONO }}>
            {searchResults.length} hits
          </span>
        )}

        {/* Zoom */}
        <div style={{ display: 'flex', gap: 2 }}>
          {([1, 2, 4] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              style={{
                padding: '3px 8px',
                background: z === zoom ? THEME.SKY : 'transparent',
                border: `1px solid ${THEME.BORDER}`,
                borderRadius: THEME.R_SM,
                color: z === zoom ? '#050505' : THEME.DIM,
                fontFamily: THEME.MONO,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              {z}x
            </button>
          ))}
        </div>

        {/* Topology toggle */}
        <button
          onClick={toggleTopology}
          style={{
            padding: '3px 10px',
            background: 'transparent',
            border: `1px solid ${THEME.BORDER}`,
            borderRadius: THEME.R_SM,
            color: THEME.DIM,
            fontFamily: THEME.SANS,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {data.topology === 'circular' ? '◯ Circular' : '— Linear'}
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          style={{
            padding: '3px 10px',
            background: 'transparent',
            border: `1px solid ${THEME.BORDER}`,
            borderRadius: THEME.R_SM,
            color: THEME.DIM,
            fontFamily: THEME.SANS,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Export FASTA
        </button>
      </div>

      {/* ── Main Content ─────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Center: sequence viewer ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Feature annotation bar */}
          <FeatureAnnotation
            data={data}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
            scrollLeft={scrollLeft}
            baseWidth={zoom === 1 ? 10 : zoom === 2 ? 12 : 16}
          />

          {/* Linear viewer */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <LinearSequenceViewer
              data={data}
              zoom={zoom}
              selectedRange={selectedRange}
              onSelectRange={setSelectedRange}
              onScrollChange={setScrollLeft}
              highlightFeatureId={selectedFeatureId}
            />
          </div>

          {/* Selection info bar */}
          {selectionInfo && (
            <div
              style={{
                padding: '6px 16px',
                background: THEME.PANEL_STRONG,
                borderTop: `1px solid ${THEME.BORDER}`,
                fontFamily: THEME.MONO,
                fontSize: 11,
                color: THEME.DIM,
                display: 'flex',
                gap: 16,
                flexShrink: 0,
              }}
            >
              <span>
                Selection: {selectionInfo.start}&ndash;{selectionInfo.end} ({selectionInfo.length} bp)
              </span>
              {selectionInfo.gc && <span>GC: {selectionInfo.gc}%</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
                {selectionInfo.sequence}
              </span>
            </div>
          )}

          {/* Circular map (if circular topology) */}
          {data.topology === 'circular' && (
            <div
              style={{
                padding: 16,
                borderTop: `1px solid ${THEME.BORDER}`,
                display: 'flex',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CircularPlasmidView
                data={data}
                selectedFeatureId={selectedFeatureId}
                onSelectFeature={setSelectedFeatureId}
                size={320}
              />
            </div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────── */}
        <div
          style={{
            width: 260,
            borderLeft: `1px solid ${THEME.BORDER}`,
            background: THEME.BG_PANEL,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Sidebar tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${THEME.BORDER}`,
              flexShrink: 0,
            }}
          >
            {(['features', 'enzymes', 'info'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  background: tab === sidebarTab ? THEME.BG_SHELL : 'transparent',
                  border: 'none',
                  borderBottom: tab === sidebarTab ? `2px solid ${THEME.SKY}` : '2px solid transparent',
                  color: tab === sidebarTab ? THEME.VALUE : THEME.DIM,
                  fontFamily: THEME.SANS,
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {/* Features tab */}
            {sidebarTab === 'features' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedFeature && (
                  <div
                    style={{
                      padding: 10,
                      background: THEME.PANEL_STRONG,
                      borderRadius: THEME.R_SM,
                      border: `1px solid ${THEME.BORDER_ACTIVE}`,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                      {selectedFeature.name}
                    </div>
                    <div style={{ fontFamily: THEME.MONO, fontSize: 10, color: THEME.DIM }}>
                      Type: {selectedFeature.type}
                      <br />
                      Position: {selectedFeature.start + 1}&ndash;{selectedFeature.end}
                      <br />
                      Strand: {selectedFeature.strand === 1 ? '→ Forward' : '← Reverse'}
                      {selectedFeature.notes && (
                        <>
                          <br />
                          {selectedFeature.notes}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {data.features.map((feat) => (
                  <div
                    key={feat.id}
                    onClick={() => setSelectedFeatureId(feat.id === selectedFeatureId ? null : feat.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 6px',
                      borderRadius: THEME.R_SM,
                      background: feat.id === selectedFeatureId ? 'rgba(175,195,214,0.12)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: feat.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontFamily: THEME.SANS, color: THEME.VALUE }}>{feat.name}</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 9, color: THEME.DIM, marginLeft: 'auto' }}>
                      {feat.start + 1}&ndash;{feat.end}
                    </span>
                  </div>
                ))}
                {data.features.length === 0 && (
                  <div style={{ color: THEME.DIM, fontSize: 11 }}>No features annotated</div>
                )}
              </div>
            )}

            {/* Enzymes tab */}
            {sidebarTab === 'enzymes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, color: THEME.DIM, marginBottom: 4 }}>
                  {restrictionSites.length} sites found
                </div>
                {restrictionSites.map((site, i) => (
                  <div
                    key={`${site.enzyme}-${site.position}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 6px',
                      fontSize: 11,
                    }}
                  >
                    <span style={{ fontFamily: THEME.MONO, fontWeight: 600, color: THEME.LILAC, width: 50 }}>
                      {site.enzyme}
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 10, color: THEME.DIM }}>
                      pos {site.position + 1}
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 9, color: THEME.DIM }}>
                      {site.strand === 1 ? '→' : '←'}
                    </span>
                  </div>
                ))}
                {restrictionSites.length === 0 && (
                  <div style={{ color: THEME.DIM, fontSize: 11 }}>No restriction sites found</div>
                )}
              </div>
            )}

            {/* Info tab */}
            {sidebarTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                <div>
                  <div style={{ color: THEME.DIM, fontSize: 10 }}>Name</div>
                  <div>{data.name}</div>
                </div>
                <div>
                  <div style={{ color: THEME.DIM, fontSize: 10 }}>Length</div>
                  <div style={{ fontFamily: THEME.MONO }}>{data.length.toLocaleString()} bp</div>
                </div>
                <div>
                  <div style={{ color: THEME.DIM, fontSize: 10 }}>Type</div>
                  <div>{data.type.toUpperCase()}</div>
                </div>
                <div>
                  <div style={{ color: THEME.DIM, fontSize: 10 }}>Topology</div>
                  <div>{data.topology}</div>
                </div>
                {data.type === 'dna' && (
                  <div>
                    <div style={{ color: THEME.DIM, fontSize: 10 }}>GC Content</div>
                    <div style={{ fontFamily: THEME.MONO }}>
                      {((data.sequence.match(/[GC]/gi)?.length ?? 0) / data.length * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ color: THEME.DIM, fontSize: 10 }}>Features</div>
                  <div>{data.features.length}</div>
                </div>
                <div>
                  <div style={{ color: THEME.DIM, fontSize: 10 }}>Restriction Sites</div>
                  <div>{restrictionSites.length}</div>
                </div>

                {/* 6-frame translation preview */}
                {translation && (
                  <div>
                    <div style={{ color: THEME.DIM, fontSize: 10, marginBottom: 4 }}>6-Frame Translation (first 60 aa)</div>
                    {Object.entries(translation).map(([frame, seq]) => (
                      <div key={frame} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontFamily: THEME.MONO, fontSize: 9, color: THEME.SKY, width: 20 }}>{frame}</span>
                        <span
                          style={{
                            fontFamily: THEME.MONO,
                            fontSize: 9,
                            color: THEME.DIM,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {seq.slice(0, 60)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
