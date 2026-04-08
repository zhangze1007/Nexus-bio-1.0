'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

interface HybridWorkbenchPanelsProps {
  leftLabel: string;
  rightLabel: string;
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  defaultTabletPanel?: 'left' | 'right';
  auxiliaryLabel?: string;
}

export default function HybridWorkbenchPanels({
  leftLabel,
  rightLabel,
  leftPanel,
  centerPanel,
  rightPanel,
  defaultTabletPanel = 'left',
  auxiliaryLabel = 'Auxiliary workbench panels',
}: HybridWorkbenchPanelsProps) {
  const [activePanel, setActivePanel] = useState<'left' | 'right'>(defaultTabletPanel);
  const id = useId();

  return (
    <div className="nb-tool-panels nb-tool-panels--hybrid-shell" style={{ flex: 1 }}>
      {leftPanel}
      {centerPanel}
      {rightPanel}

      <div className="nb-tool-panels__tablet-aux" aria-label={auxiliaryLabel}>
        <div className="nb-tool-panels__tablet-aux-header">
          <span
            className="nb-tool-panels__tablet-aux-label"
            style={{
              fontFamily: T.MONO,
              fontSize: '9px',
              color: PATHD_THEME.label,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Auxiliary panels
          </span>
          <div className="nb-tool-panels__tablet-aux-toggle" role="tablist" aria-label={auxiliaryLabel}>
            <button
              id={`${id}-tab-left`}
              type="button"
              role="tab"
              aria-selected={activePanel === 'left'}
              aria-controls={`${id}-panel-left`}
              onClick={() => setActivePanel('left')}
              data-active={activePanel === 'left' ? 'true' : 'false'}
            >
              {leftLabel}
            </button>
            <button
              id={`${id}-tab-right`}
              type="button"
              role="tab"
              aria-selected={activePanel === 'right'}
              aria-controls={`${id}-panel-right`}
              onClick={() => setActivePanel('right')}
              data-active={activePanel === 'right' ? 'true' : 'false'}
            >
              {rightLabel}
            </button>
          </div>
        </div>

        <div className="nb-tool-panels__tablet-aux-frame">
          <div
            id={`${id}-panel-left`}
            className="nb-tool-panels__tablet-pane"
            role="tabpanel"
            aria-labelledby={`${id}-tab-left`}
            hidden={activePanel !== 'left'}
          >
            {leftPanel}
          </div>
          <div
            id={`${id}-panel-right`}
            className="nb-tool-panels__tablet-pane"
            role="tabpanel"
            aria-labelledby={`${id}-tab-right`}
            hidden={activePanel !== 'right'}
          >
            {rightPanel}
          </div>
        </div>
      </div>
    </div>
  );
}
