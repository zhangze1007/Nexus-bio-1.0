'use client';
/**
 * CatDes Biosensor Tab -- Biosensor design with ligand, dynamic range,
 * sensitivity parameters, Hill response curve, and cross-talk analysis.
 */
import React from 'react';
import { THEME } from '../../../theme';
import { GLASS, BORDER, LABEL, VALUE, INPUT_BG, INPUT_BORDER, INPUT_TEXT, hdrCell, dataCell } from './catdesShared';
import ParameterPanel from '../shared/ParameterPanel';
import ResultSummaryPanel from '../shared/ResultSummaryPanel';
import ConfidenceBadge from '../shared/ConfidenceBadge';

interface BiosensorResponsePoint {
  ligandConc: number;
  signalIntensity: number;
}

interface BiosensorDesign {
  transcriptionFactor: string;
  promoter: string;
  ligand: string;
  dynamicRange: number;
  sensitivity: number;
  specificity: number;
  signalToNoise: number;
  leakExpression: number;
  orthogonality: number;
  responseCurve: BiosensorResponsePoint[];
}

interface CatDesBiosensorTabProps {
  bioResult: BiosensorDesign | null;
  bioLoading: boolean;
  bioTargetLigand: string;
  setBioTargetLigand: (s: string) => void;
  bioDynamicRange: number;
  setBioDynamicRange: (n: number) => void;
  bioSensitivity: number;
  setBioSensitivity: (n: number) => void;
  bioHost: string;
  setBioHost: (s: string) => void;
  handleBiosensorDesign: () => void;
}

export default function CatDesBiosensorTab({
  bioResult, bioLoading, bioTargetLigand, setBioTargetLigand,
  bioDynamicRange, setBioDynamicRange, bioSensitivity, setBioSensitivity,
  bioHost, setBioHost, handleBiosensorDesign,
}: CatDesBiosensorTabProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Parameter Panel */}
      <ParameterPanel
        title="Biosensor Parameters"
        defaultCollapsed={false}
        onReset={() => {
          setBioTargetLigand('arabinose');
          setBioDynamicRange(100);
          setBioSensitivity(50);
          setBioHost('ecoli');
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: 'block', marginBottom: 2 }}>Target Ligand</span>
            <select
              value={bioTargetLigand}
              onChange={e => setBioTargetLigand(e.target.value)}
              style={{ width: '100%', padding: '5px 8px', background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: THEME.FS_SM, outline: 'none' }}
            >
              {['arabinose', 'IPTG', 'aTc', 'salicylate', 'acyl-HSL', 'theophylline', 'vanillin', 'erythromycin'].map(lig => (
                <option key={lig} value={lig}>{lig}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: 'block', marginBottom: 2 }}>Host Organism</span>
            <select
              value={bioHost}
              onChange={e => setBioHost(e.target.value)}
              style={{ width: '100%', padding: '5px 8px', background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: THEME.FS_SM, outline: 'none' }}
            >
              <option value="ecoli">E. coli</option>
              <option value="yeast">S. cerevisiae</option>
              <option value="bacillus">B. subtilis</option>
            </select>
          </div>
          <div>
            <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: 'block', marginBottom: 2 }}>Desired Dynamic Range (fold)</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={bioDynamicRange}
              onChange={e => setBioDynamicRange(Number(e.target.value))}
              style={{ width: '100%', padding: '5px 8px', background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: THEME.FS_SM, outline: 'none' }}
            />
          </div>
          <div>
            <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: 'block', marginBottom: 2 }}>Desired Sensitivity (EC50 µM)</span>
            <input
              type="number"
              min={0.01}
              max={10000}
              step={0.1}
              value={bioSensitivity}
              onChange={e => setBioSensitivity(Number(e.target.value))}
              style={{ width: '100%', padding: '5px 8px', background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: THEME.FS_SM, outline: 'none' }}
            />
          </div>
        </div>
      </ParameterPanel>

      {/* Run button */}
      <div style={{
        ...GLASS,
        padding: 16,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Biosensor Designer
        </span>
        <button onClick={handleBiosensorDesign} disabled={bioLoading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: THEME.FS_SM, opacity: bioLoading ? 0.4 : 1 }}
        >
          {bioLoading ? 'Designing...' : 'Design Biosensor'}
        </button>
        {bioResult && (
          <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: 'rgba(255,255,255,0.4)' }}>
            {bioResult.transcriptionFactor} / {bioResult.promoter} | Range: {bioResult.dynamicRange.toFixed(1)}x
          </span>
        )}
      </div>

      {/* Results */}
      {bioResult && (
        <>
          {/* Result Summary */}
          <ResultSummaryPanel
            metrics={[
              { label: 'EC50', value: `${bioResult.sensitivity.toFixed(1)}`, unit: 'µM', accent: THEME.SKY },
              { label: 'Kd', value: `${bioResult.sensitivity.toFixed(1)}`, unit: 'µM', accent: THEME.MINT },
              { label: 'Dynamic Range', value: `${bioResult.dynamicRange.toFixed(1)}`, unit: 'x', accent: THEME.LILAC },
              { label: 'S/N', value: bioResult.signalToNoise.toFixed(1), accent: THEME.APRICOT },
            ]}
            actions={<ConfidenceBadge value={bioResult.specificity} label="Specificity" />}
          />

          {/* Hill Response Curve */}
          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Hill Response Curve — {bioResult.transcriptionFactor} → {bioResult.promoter}
            </span>
            {(() => {
              const pts = bioResult.responseCurve;
              const svgW = 320, svgH = 120;
              const padL = 40, padR = 10, padT = 10, padB = 24;
              const plotW = svgW - padL - padR;
              const plotH = svgH - padT - padB;
              const maxSignal = Math.max(...pts.map(p => p.signalIntensity), 0.01);
              const logMin = Math.log10(Math.max(pts[0]?.ligandConc ?? 0.001, 0.001));
              const logMax = Math.log10(Math.max(pts[pts.length - 1]?.ligandConc ?? 1000, 1));
              const pathD = pts.map((p, i) => {
                const x = padL + ((Math.log10(Math.max(p.ligandConc, 0.001)) - logMin) / (logMax - logMin)) * plotW;
                const y = padT + plotH - (p.signalIntensity / maxSignal) * plotH;
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(' ');
              return (
                <svg width={svgW} height={svgH} style={{ display: 'block', marginTop: 8 }}>
                  {/* Grid */}
                  <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="rgba(255,255,255,0.08)" />
                  <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="rgba(255,255,255,0.08)" />
                  {/* Curve */}
                  <path d={pathD} fill="none" stroke={THEME.SKY} strokeWidth={1.5} />
                  {/* Axes labels */}
                  <text x={padL + plotW / 2} y={svgH - 2} textAnchor="middle" fontFamily={THEME.MONO} fontSize="9" fill="rgba(255,255,255,0.4)">[Ligand] µM</text>
                  <text x={2} y={padT + plotH / 2} textAnchor="start" fontFamily={THEME.MONO} fontSize="9" fill="rgba(255,255,255,0.4)" transform={`rotate(-90, 8, ${padT + plotH / 2})`}>Signal</text>
                  {/* EC50 marker */}
                  {(() => {
                    const ec50Conc = bioResult.sensitivity;
                    const ec50X = padL + ((Math.log10(Math.max(ec50Conc, 0.001)) - logMin) / (logMax - logMin)) * plotW;
                    return <line x1={ec50X} y1={padT} x2={ec50X} y2={padT + plotH} stroke={THEME.CORAL} strokeWidth={0.8} strokeDasharray="3,3" />;
                  })()}
                </svg>
              );
            })()}
          </div>

          {/* Sensor Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Binding Affinity */}
            <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Binding Affinity
              </span>
              {(() => {
                const RT = 0.616;
                const kdM = bioResult.sensitivity * 1e-6;
                const deltaG = RT * Math.log(kdM);
                const kon = 1e6;
                const koff = kon * kdM;
                const halfLife = Math.log(2) / koff;
                return (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { label: 'ΔG_bind', value: `${deltaG.toFixed(2)} kcal/mol`, color: THEME.CORAL },
                      { label: 'k_on', value: `${(kon / 1e6).toFixed(1)} × 10⁶ M⁻¹s⁻¹`, color: THEME.SKY },
                      { label: 'k_off', value: `${(koff * 1000).toFixed(3)} × 10⁻³ s⁻¹`, color: THEME.MINT },
                      { label: 'Half-life', value: `${halfLife.toFixed(1)} s`, color: THEME.APRICOT },
                    ].map(m => (
                      <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL }}>{m.label}</span>
                        <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_SM, color: m.color, fontFeatureSettings: "'tnum' 1" }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* On/Off Response & Leak */}
            <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Response Characteristics
              </span>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { label: 'Dynamic Range', value: `${bioResult.dynamicRange.toFixed(1)}x`, color: THEME.LILAC },
                  { label: 'EC50 (Sensitivity)', value: `${bioResult.sensitivity.toFixed(1)} µM`, color: THEME.MINT },
                  { label: 'Specificity', value: `${(bioResult.specificity * 100).toFixed(0)}%`, color: THEME.SKY },
                  { label: 'Signal-to-Noise', value: bioResult.signalToNoise.toFixed(1), color: THEME.APRICOT },
                  { label: 'Leak Expression', value: `${(bioResult.leakExpression * 100).toFixed(2)}%`, color: bioResult.leakExpression > 0.02 ? THEME.CORAL : THEME.MINT },
                  { label: 'Orthogonality', value: `${(bioResult.orthogonality * 100).toFixed(0)}%`, color: bioResult.orthogonality > 0.8 ? THEME.MINT : THEME.RISK_LOW },
                ].map(m => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL }}>{m.label}</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_SM, color: m.color, fontFeatureSettings: "'tnum' 1" }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cross-Talk Analysis */}
          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Cross-Talk Analysis — {bioResult.transcriptionFactor}
            </span>
            {(() => {
              const cognateLigand = bioResult.ligand;
              const crossTalkLigands: Record<string, string[]> = {
                arabinose: ['glucose'],
                IPTG: [],
                aTc: [],
                salicylate: ['benzoate'],
                'acyl-HSL': ['C6-HSL', 'C8-HSL'],
                theophylline: ['caffeine'],
                vanillin: [],
                erythromycin: [],
              };
              const crossLigands = crossTalkLigands[cognateLigand] ?? [];
              return (
                <div style={{ marginTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={hdrCell}>Ligand</th>
                        <th style={{ ...hdrCell, textAlign: 'right' }}>Signal</th>
                        <th style={{ ...hdrCell, textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: 'rgba(147,203,82,0.06)' }}>
                        <td style={{ ...dataCell, textAlign: 'left', color: THEME.MINT }}>{cognateLigand}</td>
                        <td style={dataCell}>1.000</td>
                        <td style={{ ...dataCell, textAlign: 'center' }}>
                          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.MINT, background: 'rgba(147,203,82,0.12)', padding: '1px 6px', borderRadius: 4 }}>Cognate</span>
                        </td>
                      </tr>
                      {crossLigands.map(lig => (
                        <tr key={lig} style={{ background: 'rgba(250,128,114,0.04)' }}>
                          <td style={{ ...dataCell, textAlign: 'left', color: THEME.CORAL }}>{lig}</td>
                          <td style={dataCell}>0.100</td>
                          <td style={{ ...dataCell, textAlign: 'center' }}>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, background: 'rgba(250,128,114,0.12)', padding: '1px 6px', borderRadius: 4 }}>Cross-react</span>
                          </td>
                        </tr>
                      ))}
                      {crossLigands.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ ...dataCell, textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '8px 6px' }}>
                            No known cross-reactive ligands
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* Design Notes */}
          <div style={{
            fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: LABEL,
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`,
            lineHeight: 1.6,
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: VALUE, marginBottom: 4 }}>Design Notes</div>
            <div>• TF: {bioResult.transcriptionFactor} — promoter: {bioResult.promoter}</div>
            <div>• Extended Hill equation: R = α + (β − α) · L^n / (Kd^n + L^n) + γL</div>
            <div>• Binding affinity estimated from ΔG = RT·ln(Kd) at 310K</div>
            <div>• Cross-talk analysis based on TF database orthogonality (d&apos;Oelsnitz et al. 2023)</div>
          </div>
        </>
      )}
    </div>
  );
}
