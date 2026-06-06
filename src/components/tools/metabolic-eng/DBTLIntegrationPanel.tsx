'use client';

import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';

export default function DBTLIntegrationPanel({
  activeRouteLabel,
  nodeCount,
  bottleneckCount,
  recommendedNextTool,
}: {
  activeRouteLabel: string;
  nodeCount: number;
  bottleneckCount: number;
  recommendedNextTool: string;
}) {
  return (
    <div style={{
      position: 'absolute', top: '16px', right: '18px', left: 'auto',
      width: '272px', zIndex: 14,
      pointerEvents: 'auto', display: 'grid', gap: '8px',
    }}>
      <div style={{
        padding: '14px', borderRadius: '14px',
        background: 'rgba(10,12,16,0.72)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'grid', gap: '10px',
      }}>
        <div style={{ fontFamily: T.MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: PATHD_THEME.label }}>
          DBTL Integration
        </div>
        <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.value, lineHeight: 1.55 }}>
          Pathway design feeds directly into the DBTL cycle. Bottlenecks identified here become the hypotheses for the next iteration.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label }}>
            <span>Active Route</span><span style={{ color: PATHD_THEME.value }}>{activeRouteLabel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label }}>
            <span>Nodes</span><span style={{ color: PATHD_THEME.value }}>{nodeCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label }}>
            <span>Bottlenecks</span><span style={{ color: PATHD_THEME.value }}>{bottleneckCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label }}>
            <span>Next Tool</span><span style={{ color: PATHD_THEME.apricot }}>{recommendedNextTool}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
