import type { CSSProperties } from 'react';
import type {
  BlockedShowcaseTrace,
  ShowcaseTrace,
  ShowcaseTraceStep,
} from '../../types/showcaseTrace';

export interface TrustShowcaseSummaryProps {
  safeTrace: ShowcaseTrace;
  blockedTrace: BlockedShowcaseTrace;
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#f7fafc',
  color: '#172033',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const shellStyle: CSSProperties = {
  width: 'min(1120px, calc(100% - 32px))',
  margin: '0 auto',
  padding: '40px 0 56px',
};

const headerStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginBottom: 24,
};

const eyebrowStyle: CSSProperties = {
  color: '#0f766e',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.12,
  letterSpacing: 0,
};

const textStyle: CSSProperties = {
  margin: 0,
  color: '#475569',
  fontSize: 15,
  lineHeight: 1.55,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
  margin: '18px 0',
};

const panelStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #dbe4ef',
  borderRadius: 8,
  padding: 18,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};

const thStyle: CSSProperties = {
  padding: '10px 8px',
  textAlign: 'left',
  color: '#334155',
  borderBottom: '1px solid #dbe4ef',
  fontWeight: 700,
};

const tdStyle: CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid #edf2f7',
  verticalAlign: 'top',
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '2px 8px',
  borderRadius: 6,
  background: '#e0f2fe',
  color: '#075985',
  fontSize: 12,
  fontWeight: 700,
};

function idsText(ids: string[]): string {
  return ids.length === 0 ? 'none' : ids.join(', ');
}

function gateText(step: ShowcaseTraceStep): string {
  return step.expectedBlockCode
    ? `${step.expectedGateStatus} / ${step.expectedBlockCode}`
    : step.expectedGateStatus;
}

function TraceTable({ steps }: { steps: ShowcaseTraceStep[] }) {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Step</th>
          <th style={thStyle}>Tool</th>
          <th style={thStyle}>Surface</th>
          <th style={thStyle}>Decision</th>
          <th style={thStyle}>Provenance</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step) => (
          <tr key={step.stepId}>
            <td style={tdStyle}>{step.stepId}</td>
            <td style={tdStyle}><span style={badgeStyle}>{step.toolId}</span></td>
            <td style={tdStyle}>{step.surface}</td>
            <td style={tdStyle}>{gateText(step)}</td>
            <td style={tdStyle}>{idsText(step.provenanceIds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TrustShowcaseSummary({
  safeTrace,
  blockedTrace,
}: TrustShowcaseSummaryProps) {
  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header style={headerStyle}>
          <span style={eyebrowStyle}>Trust-Gated Showcase</span>
          <h1 style={titleStyle}>A Narrow Trust-Gated Pathway Trace</h1>
          <p style={{ ...textStyle, maxWidth: 820 }}>
            This artemisinin educational trace shows one safe partial output moving forward
            with provenance and one demo output blocked from becoming a protocol claim.
          </p>
          <p style={textStyle}>
            Local software trace only. Not wet-lab validation, scientific validation,
            pathway optimization, or an external benchmark claim.
          </p>
        </header>

        <section style={gridStyle}>
          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Safe Path</h2>
            <p style={textStyle}>{safeTrace.claim}</p>
            <TraceTable steps={safeTrace.steps} />
          </article>

          <article style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Blocked Path</h2>
            <p style={textStyle}>{blockedTrace.claim}</p>
            <TraceTable steps={[blockedTrace.blockedStep]} />
          </article>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Why The Block Is Honest</h2>
          <p style={textStyle}>{blockedTrace.reason}</p>
        </section>

        <section style={{ ...panelStyle, marginTop: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 20, letterSpacing: 0 }}>Non-Claims</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#475569', lineHeight: 1.7 }}>
            {[...safeTrace.nonClaims, ...blockedTrace.nonClaims].map((claim) => (
              <li key={claim}>{claim}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default TrustShowcaseSummary;
