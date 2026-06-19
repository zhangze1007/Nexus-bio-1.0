import type { CSSProperties } from 'react';
import type { TrustFalsificationMetrics, TrustMetricCounts } from '../../types/trustMetrics';
import { THEME } from '../../theme';

export interface TrustMetricsDashboardProps {
  report: TrustFalsificationMetrics;
}

interface RateTile {
  label: string;
  value: number;
  detail: string;
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#0d0f14',
  color: 'rgba(255,255,255,0.88)',
  fontFamily:
    "'Public Sans', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const shellStyle: CSSProperties = {
  width: 'min(1180px, calc(100% - 32px))',
  margin: '0 auto',
  padding: '40px 0 56px',
};

const headerStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginBottom: 28,
};

const eyebrowStyle: CSSProperties = {
  color: '#BFDCCD',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: THEME.MONO,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.12,
  letterSpacing: '-0.02em',
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 840,
  color: 'rgba(255,255,255,0.5)',
  fontSize: 16,
  lineHeight: 1.55,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
  marginBottom: 20,
};

const sectionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
  margin: '20px 0',
};

const panelStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: 18,
};

const metricValueStyle: CSSProperties = {
  margin: '8px 0 4px',
  fontSize: 30,
  fontWeight: 800,
  letterSpacing: 0,
  fontFamily: THEME.MONO,
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255,255,255,0.5)',
  fontSize: 13,
  lineHeight: 1.45,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};

const thStyle: CSSProperties = {
  padding: '10px 8px',
  textAlign: 'left',
  color: 'rgba(255,255,255,0.6)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  fontWeight: 700,
  fontFamily: THEME.MONO,
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const tdStyle: CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'top',
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '2px 8px',
  borderRadius: 6,
  background: 'rgba(191,220,205,0.12)',
  color: '#BFDCCD',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: THEME.MONO,
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}

function countRows(counts: TrustMetricCounts) {
  return [
    ['ok', counts.ok],
    ['blocked', counts.blocked],
    ['gated', counts.gated],
    ['demoOnly', counts.demoOnly],
  ] as const;
}

export function TrustMetricsDashboard({ report }: TrustMetricsDashboardProps) {
  const rateTiles: RateTile[] = [
    {
      label: 'Block Rate',
      value: report.blockRate,
      detail: 'Runtime decisions that returned blocked.',
    },
    {
      label: 'False Block Rate',
      value: report.falseBlockRate,
      detail: 'Expected-ok cases that were blocked.',
    },
    {
      label: 'Missing Provenance Rate',
      value: report.missingProvenanceRate,
      detail: 'Cases where missing provenance was present or detected.',
    },
    {
      label: 'Unsafe Export Prevention Rate',
      value: report.unsafeExportPreventionRate,
      detail: 'Unsafe formal-surface cases that did not become ok.',
    },
    {
      label: 'Demo Leakage Rate',
      value: report.demoLeakageRate,
      detail: 'Demo formal-surface cases that became ok.',
    },
    {
      label: 'Known-Bad Coverage Rate',
      value: report.knownBadCoverageRate,
      detail: 'Required known-bad regression tags represented.',
    },
  ];

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header style={headerStyle}>
          <span style={eyebrowStyle}>Trust Runtime</span>
          <h1 style={titleStyle}>Falsification Dashboard</h1>
          <p style={subtitleStyle}>
            Local benchmark report for trust-runtime progression and refusal behavior.
            This page shows what the runtime allowed, gated, or blocked in the benchmark corpus.
          </p>
          <p style={labelStyle}>
            Generated {formatDate(report.generatedAt)} | run {report.runLabel}
            {report.corpusVersion ? ` | corpus ${report.corpusVersion}` : ''}
          </p>
        </header>

        <section style={gridStyle} aria-label="Trust metric rates">
          {rateTiles.map((tile) => (
            <article key={tile.label} style={panelStyle}>
              <p style={{ ...labelStyle, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{tile.label}</p>
              <p style={metricValueStyle}>{formatPercent(tile.value)}</p>
              <p style={labelStyle}>{tile.detail}</p>
            </article>
          ))}
        </section>

        <section style={sectionGridStyle}>
          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Successful Progression</h2>
            <p style={metricValueStyle}>{report.progressionSummary.successfulProgressions}</p>
            <p style={labelStyle}>
              Expected-ok cases that remained ok out of {report.progressionSummary.expectedOkCases}.
            </p>
            <p style={labelStyle}>
              False blocked cases: {report.progressionSummary.falseBlockedCases}.
            </p>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Successful Blocking</h2>
            <p style={metricValueStyle}>
              {report.preventionSummary.preventedUnsafeFormalSurfaceCases}
            </p>
            <p style={labelStyle}>
              Unsafe formal-surface cases that did not become ok out of{' '}
              {report.preventionSummary.unsafeFormalSurfaceCases}.
            </p>
            <p style={labelStyle}>
              Leaked unsafe formal-surface cases: {report.preventionSummary.leakedUnsafeFormalSurfaceCases}.
            </p>
          </article>
        </section>

        <section style={sectionGridStyle}>
          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Status Counts</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Cases</th>
                </tr>
              </thead>
              <tbody>
                {countRows(report.statusCounts).map(([status, count]) => (
                  <tr key={status}>
                    <td style={tdStyle}><span style={badgeStyle}>{status}</span></td>
                    <td style={tdStyle}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Known-Bad Summary</h2>
            <table style={tableStyle}>
              <tbody>
                <tr>
                  <th style={thStyle}>Known-bad cases</th>
                  <td style={tdStyle}>{report.knownBadSummary.totalKnownBadCases}</td>
                </tr>
                <tr>
                  <th style={thStyle}>Prevented</th>
                  <td style={tdStyle}>{report.knownBadSummary.preventedKnownBadCases}</td>
                </tr>
                <tr>
                  <th style={thStyle}>Leaked</th>
                  <td style={tdStyle}>{report.knownBadSummary.leakedKnownBadCases}</td>
                </tr>
                <tr>
                  <th style={thStyle}>Missing required tags</th>
                  <td style={tdStyle}>
                    {report.knownBadCoverage.missingTags.length === 0
                      ? 'None'
                      : report.knownBadCoverage.missingTags.join(', ')}
                  </td>
                </tr>
              </tbody>
            </table>
          </article>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Mismatches</h2>
          {report.mismatches.length === 0 ? (
            <p style={labelStyle}>No evaluator mismatches were reported for this local corpus run.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Case</th>
                  <th style={thStyle}>Surface</th>
                  <th style={thStyle}>Expected</th>
                  <th style={thStyle}>Actual</th>
                  <th style={thStyle}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {report.mismatches.map((mismatch) => (
                  <tr key={mismatch.caseId}>
                    <td style={tdStyle}>{mismatch.caseId}</td>
                    <td style={tdStyle}>{mismatch.surface}</td>
                    <td style={tdStyle}>
                      {mismatch.expectedStatus}
                      {mismatch.expectedBlockCode ? ` / ${mismatch.expectedBlockCode}` : ''}
                    </td>
                    <td style={tdStyle}>
                      {mismatch.actualStatus}
                      {mismatch.actualBlockCode ? ` / ${mismatch.actualBlockCode}` : ''}
                    </td>
                    <td style={tdStyle}>{mismatch.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section style={{ ...panelStyle, marginTop: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Scope</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default TrustMetricsDashboard;
