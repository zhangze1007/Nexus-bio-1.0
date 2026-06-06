'use client';

import { useState, type CSSProperties } from 'react';
import ScientificHero from '../shared/ScientificHero';
import ScientificMethodStrip from '../shared/ScientificMethodStrip';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';
import type { PathwayNode, PathwayEdge } from '../../../types';
import type { WorkbenchAnalyzeArtifact } from '../../../store/workbenchTypes';

type ControlVarsStyle = CSSProperties & Record<`--${string}`, string>;

const PATHD_SUPPORT_RAIL_WIDTH = 272;

export default function EvidenceTabRail({
  activeRouteLabel,
  selectedNodeLabel,
  derivedTarget,
  activeNodes,
  activeEdges,
  activeAnalyzeArtifact,
  recommendedNextTool,
  embedded,
  width,
}: {
  activeRouteLabel: string;
  selectedNodeLabel?: string;
  derivedTarget: string;
  activeNodes: PathwayNode[];
  activeEdges: PathwayEdge[];
  activeAnalyzeArtifact: WorkbenchAnalyzeArtifact | null;
  recommendedNextTool: string;
  embedded: boolean;
  width: number;
}) {
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [methodStripDismissed, setMethodStripDismissed] = useState(false);

  return (
    <div
      className="nb-pathd-hero-stack nb-pathd-hero-stack--rail"
      style={{
        position: 'absolute',
        top: '16px',
        right: '18px',
        left: 'auto',
        transform: 'none',
        width: `${PATHD_SUPPORT_RAIL_WIDTH}px`,
        zIndex: 14,
        pointerEvents: 'none',
        display: 'grid',
        gap: '8px',
        maxHeight: embedded ? 'min(34vh, 300px)' : 'min(33vh, 300px)',
        overflowY: 'auto',
        paddingRight: '2px',
      }}
    >
      {!heroDismissed && <div style={{ pointerEvents: 'auto' }}>
        <ScientificHero
          eyebrow="Stage 1 · Pathway & Enzyme Design"
          title={`${activeRouteLabel} is the current design object`}
          summary="PATHD should read like the front door to the whole scientific program. This page now surfaces the active route, bottleneck pressure, enzyme opportunity, and next tool handoff before the scientist dives into the 3D pathway graph."
          dismissible
          onDismiss={() => setHeroDismissed(true)}
          aside={
            <>
              <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Current focus
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                {selectedNodeLabel ?? derivedTarget}
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                {selectedNodeLabel
                  ? 'A specific pathway node is in focus, so downstream interpretation should respect this current design emphasis.'
                  : 'No node is pinned yet; the route remains the active object at pathway scale.'}
              </div>
            </>
          }
          signals={[
            {
              label: 'Target Product',
              value: derivedTarget,
              detail: `${activeNodes.length} nodes · ${activeEdges.length} edges in the current executable route graph`,
              tone: 'cool',
            },
            {
              label: 'Bottlenecks',
              value: `${activeAnalyzeArtifact?.bottleneckAssumptions.length ?? 0}`,
              detail: activeAnalyzeArtifact?.bottleneckAssumptions[0]?.label ?? 'No structured bottleneck has been injected from Analyze yet.',
              tone: (activeAnalyzeArtifact?.bottleneckAssumptions.length ?? 0) > 0 ? 'warm' : 'neutral',
            },
            {
              label: 'Enzyme Candidates',
              value: `${activeAnalyzeArtifact?.enzymeCandidates.length ?? 0}`,
              detail: activeAnalyzeArtifact?.enzymeCandidates[0]?.label ?? 'No enzyme candidate has been prioritized yet.',
              tone: 'neutral',
            },
            {
              label: 'Next Tool',
              value: recommendedNextTool,
              detail: 'PATHD now makes the next scientific handoff explicit instead of leaving the route as a dead-end visualization.',
              tone: 'warm',
            },
          ]}
        />
      </div>}
      {!methodStripDismissed && <div style={{ pointerEvents: 'auto' }}>
        <ScientificMethodStrip
          label="Pathway workbench"
          dismissible
          onDismiss={() => setMethodStripDismissed(true)}
          items={[
            {
              title: 'Route object',
              detail: 'The active route is treated as the canonical scientific object, so every downstream handoff inherits the same graph rather than rebuilding assumptions from scratch.',
              accent: PATHD_THEME.apricot,
              note: `${activeNodes.length} nodes · ${activeEdges.length} edges`,
            },
            {
              title: '3D scientific canvas',
              detail: 'The immersive pathway graph remains the main stage, but it is now framed by clear evidence and handoff language instead of reading like a standalone visual demo.',
              accent: PATHD_THEME.sky,
              note: selectedNodeLabel ?? derivedTarget,
            },
            {
              title: 'Execution handoff',
              detail: 'Bottlenecks, enzyme candidates, and next-tool routing stay visible so the page behaves like the front door to the rest of the workbench.',
              accent: PATHD_THEME.mint,
              note: recommendedNextTool,
            },
          ]}
        />
      </div>}
      {(heroDismissed || methodStripDismissed) && (
        <div style={{ pointerEvents: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="nb-ui-control"
            onClick={() => { setHeroDismissed(false); setMethodStripDismissed(false); }}
            style={{
              padding: '5px 12px',
              borderRadius: '100px',
              background: 'var(--nb-control-bg)',
              border: '1px solid var(--nb-control-border)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              color: 'var(--nb-control-color)',
              fontFamily: T.MONO,
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
              ['--nb-control-bg' as const]: 'rgba(10,12,16,0.52)',
              ['--nb-control-border' as const]: 'rgba(255,255,255,0.14)',
              ['--nb-control-color' as const]: PATHD_THEME.label,
              ['--nb-control-hover-bg' as const]: '#ffffff',
              ['--nb-control-hover-border' as const]: '#ffffff',
              ['--nb-control-hover-color' as const]: PATHD_THEME.ink,
              ['--nb-control-active-bg' as const]: '#ffffff',
              ['--nb-control-active-border' as const]: '#ffffff',
              ['--nb-control-active-color' as const]: PATHD_THEME.ink,
            } as ControlVarsStyle}
          >
            Restore dashboard
          </button>
        </div>
      )}
    </div>
  );
}
