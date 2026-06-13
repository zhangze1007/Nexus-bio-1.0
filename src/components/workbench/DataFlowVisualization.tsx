'use client';
import React from 'react';
import { useWorkbenchStore } from '../../store/workbenchStore';

// Ordered pipeline: each tool feeds the next
const PIPELINE_NODES = [
  { key: 'pathd', label: 'PATHD' },
  { key: 'fbasim', label: 'FBAsim' },
  { key: 'cethx', label: 'CETHX' },
  { key: 'catdes', label: 'CatDes' },
  { key: 'cellfree', label: 'CellFree' },
  { key: 'dyncon', label: 'DynCon' },
] as const;

type PipelineKey = (typeof PIPELINE_NODES)[number]['key'];

const ACTIVE_COLOR = '#4ade80';   // green-400
const INACTIVE_COLOR = '#374151'; // gray-700
const ARROW_COLOR = '#6b7280';    // gray-500
const BG_COLOR = '#0d0f14';
const BORDER_COLOR = '#1e2130';

/**
 * Horizontal data-flow strip showing which tools in the pipeline have
 * workbench payloads.  Active nodes glow green; inactive ones are dimmed.
 */
export default function DataFlowVisualization() {
  const toolPayloads = useWorkbenchStore((s) => s.toolPayloads);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '12px 16px',
        background: BG_COLOR,
        border: `1px solid ${BORDER_COLOR}`,
        borderRadius: 8,
        overflowX: 'auto',
      }}
    >
      {PIPELINE_NODES.map((node, i) => {
        const hasPayload = Boolean(toolPayloads[node.key as PipelineKey]);
        const isActive = hasPayload;
        const isLast = i === PIPELINE_NODES.length - 1;

        return (
          <React.Fragment key={node.key}>
            {/* Node */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                minWidth: 64,
              }}
            >
              {/* Dot indicator */}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: isActive ? ACTIVE_COLOR : INACTIVE_COLOR,
                  boxShadow: isActive ? `0 0 6px ${ACTIVE_COLOR}60` : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
              {/* Label */}
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: isActive ? ACTIVE_COLOR : '#6b7280',
                  textTransform: 'uppercase',
                  transition: 'color 0.3s ease',
                }}
              >
                {node.label}
              </span>
            </div>

            {/* Arrow connector */}
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  minWidth: 24,
                  height: 1,
                  background: `linear-gradient(90deg, ${isActive ? ACTIVE_COLOR : ARROW_COLOR}40, ${ARROW_COLOR}40)`,
                  position: 'relative',
                  margin: '0 2px',
                }}
              >
                {/* Arrowhead */}
                <div
                  style={{
                    position: 'absolute',
                    right: -2,
                    top: -3,
                    width: 0,
                    height: 0,
                    borderTop: '4px solid transparent',
                    borderBottom: '4px solid transparent',
                    borderLeft: `5px solid ${ARROW_COLOR}80`,
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
