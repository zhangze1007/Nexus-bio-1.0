# Workbench & Tool Page Layout Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure WorkbenchStatusBar to 1-row + 3-tab drawer, convert all 10 tool pages from scrollable sections to tabbed visualization-first layouts with floating control rails and inline metric overlays.

**Architecture:** New shared components (ToolTabBar, ToolTabPanel, FloatingControlRail, InlineMetricOverlay) provide the tab and rail infrastructure. ScientificHero defaults to collapsed. ToolShell gets tab support. Each tool page is restructured to use tabs + rail + inline overlays.

**Tech Stack:** React 19, TypeScript, Next.js 15, Framer Motion 12, Zustand 5, inline styles (no CSS modules except ScSpatial)

**Spec:** `docs/superpowers/specs/2026-05-08-workbench-tool-layout-redesign.md`

---

## File Structure

### New files:
- `src/components/tools/shared/ToolTabBar.tsx` — Tab navigation with animated indicator
- `src/components/tools/shared/ToolTabPanel.tsx` — Tab content with AnimatePresence
- `src/components/tools/shared/FloatingControlRail.tsx` — Narrow left sidebar for params
- `src/components/tools/shared/InlineMetricOverlay.tsx` — Floating metric on visualization

### Modified files:
- `src/components/workbench/workbenchDesignSystem.ts` — Add new style exports
- `src/components/tools/shared/ScientificHero.tsx` — Default collapsed
- `src/components/tools/shared/ToolShell.tsx` — Add tab infrastructure
- `src/components/workbench/WorkbenchStatusBar.tsx` — 1-row + 3-tab drawer
- `src/components/tools/FBASimPage.tsx` — Tabbed layout
- `src/components/tools/DynConPage.tsx` — Tabbed layout
- `src/components/tools/CellFreePage.tsx` — Tabbed layout
- `src/components/tools/CETHXPage.tsx` — Tabbed layout
- `src/components/tools/CatalystDesignerPage.tsx` — Tabbed layout
- `src/components/tools/GenMIMPage.tsx` — Tabbed layout
- `src/components/tools/MultiOPage.tsx` — Tabbed layout
- `src/components/tools/NEXAIPage.tsx` — Sidebar design
- `src/components/tools/ScSpatialPage.tsx` — Tabbed layout
- `src/components/tools/PathDPage.tsx` — Tabbed layout (wraps MetabolicEngPage)

---

## Phase 1: Shared Components

### Task 1: Create ToolTabBar

**Files:**
- Create: `src/components/tools/shared/ToolTabBar.tsx`

- [ ] **Step 1: Create ToolTabBar component**

```tsx
'use client';

import { motion } from 'framer-motion';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

export interface ToolTab {
  id: string;
  label: string;
  accent?: string;
}

interface ToolTabBarProps {
  tabs: ToolTab[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function ToolTabBar({ tabs, activeId, onChange }: ToolTabBarProps) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: '2px',
        padding: '0 16px',
        borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.sepiaPanelMuted,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const accent = tab.accent ?? PATHD_THEME.sky;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: T.SANS,
              fontSize: '12px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? accent : PATHD_THEME.label,
              transition: 'color 0.2s ease',
            }}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: accent,
                  borderRadius: '2px 2px 0 0',
                }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit --pretty src/components/tools/shared/ToolTabBar.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/shared/ToolTabBar.tsx
git commit -m "feat: add ToolTabBar shared component"
```

---

### Task 2: Create ToolTabPanel

**Files:**
- Create: `src/components/tools/shared/ToolTabPanel.tsx`

- [ ] **Step 1: Create ToolTabPanel component**

```tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface ToolTabPanelProps {
  tabId: string;
  activeId: string;
  children: React.ReactNode;
}

export default function ToolTabPanel({ tabId, activeId, children }: ToolTabPanelProps) {
  const isActive = tabId === activeId;

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key={tabId}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit --pretty src/components/tools/shared/ToolTabPanel.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/shared/ToolTabPanel.tsx
git commit -m "feat: add ToolTabPanel shared component"
```

---

### Task 3: Create FloatingControlRail

**Files:**
- Create: `src/components/tools/shared/FloatingControlRail.tsx`

- [ ] **Step 1: Create FloatingControlRail component**

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

interface FloatingControlRailProps {
  children: React.ReactNode;
  width?: number;
  label?: string;
  defaultCollapsed?: boolean;
}

export default function FloatingControlRail({
  children,
  width = 200,
  label = 'Controls',
  defaultCollapsed = false,
}: FloatingControlRailProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <motion.div
      animate={{ width: collapsed ? 40 : width }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        flexShrink: 0,
        borderRight: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.sepiaPanelMuted,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: '10px 12px',
          borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        {!collapsed && (
          <span
            style={{
              fontFamily: T.SANS,
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: PATHD_THEME.label,
            }}
          >
            {label}
          </span>
        )}
        {collapsed ? (
          <ChevronRight size={14} color={PATHD_THEME.label} />
        ) : (
          <ChevronLeft size={14} color={PATHD_THEME.label} />
        )}
      </div>

      {/* Content */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit --pretty src/components/tools/shared/FloatingControlRail.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/shared/FloatingControlRail.tsx
git commit -m "feat: add FloatingControlRail shared component"
```

---

### Task 4: Create InlineMetricOverlay

**Files:**
- Create: `src/components/tools/shared/InlineMetricOverlay.tsx`

- [ ] **Step 1: Create InlineMetricOverlay component**

```tsx
'use client';

import { motion } from 'framer-motion';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

interface MetricItem {
  label: string;
  value: string;
  accent?: string;
}

interface InlineMetricOverlayProps {
  metrics: MetricItem[];
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
}

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  'top-right': { top: '12px', right: '12px' },
  'bottom-right': { bottom: '12px', right: '12px' },
  'top-left': { top: '12px', left: '12px' },
  'bottom-left': { bottom: '12px', left: '12px' },
};

export default function InlineMetricOverlay({
  metrics,
  position = 'top-right',
}: InlineMetricOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'absolute',
        ...POSITION_STYLES[position],
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px 12px',
        borderRadius: '12px',
        background: 'rgba(16, 19, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      {metrics.map((metric) => (
        <div key={metric.label} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontFamily: T.MONO,
              fontSize: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: PATHD_THEME.label,
              minWidth: '60px',
            }}
          >
            {metric.label}
          </span>
          <span
            style={{
              fontFamily: T.MONO,
              fontSize: '12px',
              fontWeight: 600,
              color: metric.accent ?? PATHD_THEME.value,
            }}
          >
            {metric.value}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit --pretty src/components/tools/shared/InlineMetricOverlay.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/shared/InlineMetricOverlay.tsx
git commit -m "feat: add InlineMetricOverlay shared component"
```

---

### Task 5: Update workbenchDesignSystem exports

**Files:**
- Modify: `src/components/workbench/workbenchDesignSystem.ts`

- [ ] **Step 1: Add new style exports for tab and rail patterns**

Add at the end of the file:

```ts
/** Tab container style */
export const tabContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
};

/** Tab content area (below tab bar) */
export const tabContent: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  minHeight: 0,
  overflow: 'hidden',
};

/** Rail + main content horizontal layout */
export const railMainLayout: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
};

/** Main visualization area (next to rail) */
export const mainVizArea: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  padding: '12px',
};
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/workbench/workbenchDesignSystem.ts
git commit -m "feat: add tab/rail layout styles to design system"
```

---

## Phase 2: ScientificHero & ToolShell

### Task 6: Make ScientificHero default collapsed

**Files:**
- Modify: `src/components/tools/shared/ScientificHero.tsx`

- [ ] **Step 1: Change default collapsed state**

Find in the component:
```tsx
const [collapsed, setCollapsed] = useState(true);
```

This already defaults to collapsed. Verify the collapsed view renders as a 28px lineage bar. If the collapsed view is taller than 32px, reduce padding/fontSize to achieve 28px total height.

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/shared/ScientificHero.tsx
git commit -m "fix: ensure ScientificHero defaults to 28px collapsed state"
```

---

### Task 7: Add tab infrastructure to ToolShell

**Files:**
- Modify: `src/components/tools/shared/ToolShell.tsx`

- [ ] **Step 1: Add tab props to ToolShellProps**

Add to the interface:
```tsx
import type { ToolTab } from './ToolTabBar';
import ToolTabBar from './ToolTabBar';

// Add to ToolShellProps:
/** Tab definitions for tabbed layout mode */
tabs?: ToolTab[];
/** Currently active tab ID */
activeTab?: string;
/** Tab change handler */
onTabChange?: (id: string) => void;
```

- [ ] **Step 2: Render tab bar when tabs prop is provided**

In the render function, after the hero section and before the main content, add:
```tsx
{tabs && activeTab && onTabChange && (
  <ToolTabBar tabs={tabs} activeId={activeTab} onChange={onTabChange} />
)}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/tools/shared/ToolShell.tsx
git commit -m "feat: add tab infrastructure to ToolShell"
```

---

## Phase 3: WorkbenchStatusBar

### Task 8: Restructure WorkbenchStatusBar to 1-row summary

**Files:**
- Modify: `src/components/workbench/WorkbenchStatusBar.tsx`

- [ ] **Step 1: Create compact 1-row header**

Replace the current 4-row header (Stage Rail + 4 info cards + Golden Path Dashboard + Next Step) with a single compact row. The new header structure:

```tsx
{/* 1-Row Compact Header */}
<div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  gap: '12px',
  flexWrap: 'wrap',
}}>
  {/* Left: Stage Rail (compact pills) */}
  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
    {WORKBENCH_STAGES.map((s) => (
      <button
        key={s.id}
        onClick={() => {/* navigate to stage */}}
        style={{
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '10px',
          fontFamily: T.MONO,
          background: currentStageId === s.id ? 'rgba(255,255,255,0.1)' : 'transparent',
          border: `1px solid ${currentStageId === s.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
          color: currentStageId === s.id ? PATHD_THEME.value : PATHD_THEME.label,
          cursor: 'pointer',
        }}
      >
        {s.shortLabel ?? s.id.replace('stage-', 'S')}
      </button>
    ))}
  </div>

  {/* Center: Project summary + status chips */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
    <span style={{ fontFamily: T.SANS, fontSize: '12px', color: PATHD_THEME.value, fontWeight: 600 }}>
      {project?.targetProduct ?? 'No project'}
    </span>
    {analyzeArtifact && (
      <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label }}>
        {analyzeArtifact.nodes.length} nodes
      </span>
    )}
    <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label }}>
      stage {currentStageId?.replace('stage-', '') ?? '?'}
    </span>
    {/* Status chips */}
    <span style={{
      ...statusChip.base,
      background: freshness.status === 'fresh' ? 'rgba(191,220,205,0.15)' : 'rgba(232,163,161,0.15)',
      border: `1px solid ${freshness.status === 'fresh' ? 'rgba(191,220,205,0.3)' : 'rgba(232,163,161,0.3)'}`,
      color: freshness.status === 'fresh' ? PATHD_THEME.mint : PATHD_THEME.coral,
    }}>
      {freshness.status === 'fresh' ? '✓ fresh' : 'stale'}
    </span>
    {workflowControl.nextRecommendedNode && (
      <span style={{
        ...statusChip.base,
        background: 'rgba(175,195,214,0.15)',
        border: '1px solid rgba(175,195,214,0.3)',
        color: PATHD_THEME.sky,
      }}>
        next: {workflowControl.nextRecommendedNode.toUpperCase()}
      </span>
    )}
  </div>

  {/* Right: Action buttons + drawer toggle */}
  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
    {/* Research, Analyze, Axon buttons */}
    <button onClick={() => setDrawerOpen(!drawerOpen)} style={{
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '10px',
      fontFamily: T.MONO,
      background: drawerOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
      border: `1px solid ${drawerOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
      color: PATHD_THEME.label,
      cursor: 'pointer',
    }}>
      {drawerOpen ? '✕ Close' : '⋯ Details'}
    </button>
  </div>
</div>
```

- [ ] **Step 2: Remove old 4-row header sections**

Remove or comment out:
- The old Stage Rail section (row 1)
- The 4 info cards grid (row 2)
- The Golden Path Dashboard card (row 3)
- The Next Step indicator (row 4)

Keep the drawer logic (will be restructured in Task 9).

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/workbench/WorkbenchStatusBar.tsx
git commit -m "feat: restructure WorkbenchStatusBar to 1-row compact header"
```

---

### Task 9: Convert drawer to 3-tab layout

**Files:**
- Modify: `src/components/workbench/WorkbenchStatusBar.tsx`

- [ ] **Step 1: Add drawer tab state**

Add state for the active drawer tab:
```tsx
const [drawerTab, setDrawerTab] = useState<'status' | 'evidence' | 'history'>('status');
```

- [ ] **Step 2: Create 3-tab drawer structure**

Replace the current drawer content with a tabbed layout:

```tsx
{/* Drawer */}
<AnimatePresence>
  {drawerOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ overflow: 'hidden' }}
    >
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '0 16px',
        borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
      }}>
        {(['status', 'evidence', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDrawerTab(tab)}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${drawerTab === tab ? PATHD_THEME.sky : 'transparent'}`,
              fontFamily: T.SANS,
              fontSize: '11px',
              color: drawerTab === tab ? PATHD_THEME.value : PATHD_THEME.label,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
        {drawerTab === 'status' && <StatusTabContent />}
        {drawerTab === 'evidence' && <EvidenceTabContent />}
        {drawerTab === 'history' && <HistoryTabContent />}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 3: Create StatusTabContent component**

Extract the Feedback, Integrity, Canonical State, and Gate sections into a `StatusTabContent` sub-component using glass panels from the design system.

- [ ] **Step 4: Create EvidenceTabContent component**

Extract the Evidence, Analyze Artifact, and Evidence Trace sections into an `EvidenceTabContent` sub-component.

- [ ] **Step 5: Create HistoryTabContent component**

Render `WorkbenchAuditTimeline` and `WorkbenchExperimentLedger` in a `HistoryTabContent` sub-component.

- [ ] **Step 6: Verify build compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/components/workbench/WorkbenchStatusBar.tsx
git commit -m "feat: convert WorkbenchStatusBar drawer to 3-tab layout"
```

---

## Phase 4: Tool Page Layouts — Group A

### Task 10: Restructure FBASimPage to tabbed layout

**Files:**
- Modify: `src/components/tools/FBASimPage.tsx`

- [ ] **Step 1: Add tab state and tab definitions**

At the top of the component, add:
```tsx
import ToolTabBar, { type ToolTab } from './shared/ToolTabBar';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';

const TABS: ToolTab[] = [
  { id: 'flux-map', label: 'Flux Map', accent: PATHD_THEME.sky },
  { id: 'knockout', label: 'Knockout', accent: PATHD_THEME.coral },
  { id: 'shadow', label: 'Shadow Prices', accent: PATHD_THEME.apricot },
  { id: 'community', label: 'Community', accent: PATHD_THEME.mint },
];

const [activeTab, setActiveTab] = useState('flux-map');
```

- [ ] **Step 2: Wrap content in ToolShell with tabs prop**

Pass `tabs={TABS}`, `activeTab={activeTab}`, `onTabChange={setActiveTab}` to ToolShell.

- [ ] **Step 3: Replace scrollable sections with tab panels**

Wrap each major section in a `ToolTabPanel`:
- FluxMap SVG → `tabId="flux-map"`
- Knockout controls + network → `tabId="knockout"`
- Shadow prices table → `tabId="shadow"`
- Community mode (StrainPanel x2 + SharedMetaboliteBus) → `tabId="community"`

- [ ] **Step 4: Replace left sidebar with FloatingControlRail**

Wrap the parameter sliders (Glucose, O₂, Objective) in `<FloatingControlRail label="Parameters">`.

- [ ] **Step 5: Add InlineMetricOverlay to FluxMap**

Position growth rate, ATP yield, carbon efficiency as floating overlays on the network SVG.

- [ ] **Step 6: Move AlgorithmInsight + ScientificMethodStrip into hero expand**

Remove these as separate sections. They'll be revealed when the user clicks to expand the collapsed ScientificHero.

- [ ] **Step 7: Verify build compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/components/tools/FBASimPage.tsx
git commit -m "feat: restructure FBASimPage to tabbed visualization-first layout"
```

---

### Task 11: Restructure DynConPage to tabbed layout

**Files:**
- Modify: `src/components/tools/DynConPage.tsx`

- [ ] **Step 1: Add tab state and definitions**

```tsx
const TABS: ToolTab[] = [
  { id: 'trajectory', label: 'Trajectory', accent: PATHD_THEME.sky },
  { id: 'hill', label: 'Hill Curve', accent: PATHD_THEME.mint },
  { id: 'convergence', label: 'Convergence', accent: PATHD_THEME.apricot },
  { id: 'rbs', label: 'RBS Bridge', accent: PATHD_THEME.lilac },
];
```

- [ ] **Step 2: Wrap TimeSeriesSVG in ToolTabPanel (trajectory tab)**

- [ ] **Step 3: Wrap HillCurveSVG in ToolTabPanel (hill tab)**

- [ ] **Step 4: Create ConvergenceTabPanel** with StatRow components for settling time, overshoot, etc.

- [ ] **Step 5: Create RBSTabPanel** with RBS mapping info, DNA sequence, strength bar.

- [ ] **Step 6: Replace left sidebar with FloatingControlRail**

Move PID sliders (Kp, Ki, Kd, Setpoint) and Hill params (Vmax, Kd, n) into the rail.

- [ ] **Step 7: Add InlineMetricOverlay** for stability, titer, RMSE on trajectory view.

- [ ] **Step 8: Verify build compiles + commit**

---

### Task 12: Restructure CellFreePage to tabbed layout

**Files:**
- Modify: `src/components/tools/CellFreePage.tsx`

- [ ] **Step 1: Add tab state and definitions**

```tsx
const TABS: ToolTab[] = [
  { id: 'time-course', label: 'Time Course', accent: PATHD_THEME.sky },
  { id: 'resources', label: 'Resources', accent: PATHD_THEME.coral },
  { id: 'fitting', label: 'Fitting', accent: PATHD_THEME.mint },
  { id: 'iviv', label: 'IVIV', accent: PATHD_THEME.apricot },
  { id: 'reactor', label: 'Reactor 3D', accent: PATHD_THEME.lilac },
];
```

- [ ] **Step 2: Wrap each chart in ToolTabPanel**

- [ ] **Step 3: Replace construct parameter area with FloatingControlRail**

- [ ] **Step 4: Verify build compiles + commit**

---

### Task 13: Restructure CETHXPage to tabbed layout

**Files:**
- Modify: `src/components/tools/CETHXPage.tsx`

- [ ] **Step 1: Add tab state and definitions**

```tsx
const TABS: ToolTab[] = [
  { id: 'waterfall', label: 'Waterfall', accent: PATHD_THEME.sky },
  { id: 'atp', label: 'ATP Ledger', accent: PATHD_THEME.apricot },
  { id: 'feasibility', label: 'Feasibility', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 2: Wrap BreathingWaterfall in ToolTabPanel (waterfall tab)**

- [ ] **Step 3: Create ATP ledger and Feasibility tab panels**

- [ ] **Step 4: Verify build compiles + commit**

---

## Phase 5: Tool Page Layouts — Group B

### Task 14: Restructure CatalystDesignerPage to tabbed layout

**Files:**
- Modify: `src/components/tools/CatalystDesignerPage.tsx`

- [ ] **Step 1: Add tab state and definitions**

```tsx
const TABS: ToolTab[] = [
  { id: '3d-viewer', label: '3D Viewer', accent: PATHD_THEME.sky },
  { id: 'binding', label: 'Binding', accent: PATHD_THEME.mint },
  { id: 'sequences', label: 'Sequences', accent: PATHD_THEME.apricot },
  { id: 'pareto', label: 'Pareto', accent: PATHD_THEME.lilac },
  { id: 'mutagenesis', label: 'Mutagenesis', accent: PATHD_THEME.coral },
];
```

- [ ] **Step 2: Make CatalystViewer3D the default tab content**

- [ ] **Step 3: Move other views into ToolTabPanels**

- [ ] **Step 4: Replace controls with FloatingControlRail**

- [ ] **Step 5: Verify build compiles + commit**

---

### Task 15: Restructure GenMIMPage to tabbed layout

**Files:**
- Modify: `src/components/tools/GenMIMPage.tsx`

- [ ] **Step 1: Add tab state and definitions**

```tsx
const TABS: ToolTab[] = [
  { id: 'genome-map', label: 'Genome Map', accent: PATHD_THEME.sky },
  { id: 'targets', label: 'Targets', accent: PATHD_THEME.coral },
  { id: 'schedule', label: 'Schedule', accent: PATHD_THEME.apricot },
  { id: 'efficiency', label: 'Efficiency', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 2: Make GenomeMap the default tab**

- [ ] **Step 3: Move target table and schedule into separate tabs**

- [ ] **Step 4: Verify build compiles + commit**

---

### Task 16: Restructure MultiOPage to tabbed layout

**Files:**
- Modify: `src/components/tools/MultiOPage.tsx`

- [ ] **Step 1: Add tab state and definitions**

```tsx
const TABS: ToolTab[] = [
  { id: 'embedding', label: 'Embedding', accent: PATHD_THEME.sky },
  { id: 'volcano', label: 'Volcano', accent: PATHD_THEME.coral },
  { id: 'factors', label: 'Factors', accent: PATHD_THEME.lilac },
  { id: 'projection', label: 'Projection', accent: PATHD_THEME.apricot },
  { id: 'efficiency', label: 'Efficiency', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 2: Replace ViewMode toggle with tabs**

- [ ] **Step 3: Wrap each visualization in ToolTabPanel**

- [ ] **Step 4: Replace layer filter controls with FloatingControlRail**

- [ ] **Step 5: Verify build compiles + commit**

---

## Phase 6: Tool Page Layouts — Group C

### Task 17: Restructure ScSpatialPage to tabbed layout

**Files:**
- Modify: `src/components/tools/ScSpatialPage.tsx`

- [ ] **Step 1: Add tab state and definitions**

```tsx
const TABS: ToolTab[] = [
  { id: 'hex-grid', label: 'Hex Grid', accent: PATHD_THEME.sky },
  { id: 'umap', label: 'UMAP', accent: PATHD_THEME.lilac },
  { id: 'clusters', label: 'Clusters', accent: PATHD_THEME.apricot },
  { id: 'expression', label: 'Gene Expression', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 2: Make ScSpatialViewport the default tab**

- [ ] **Step 3: Move cluster and gene expression views into tabs**

- [ ] **Step 4: Replace ScSpatialControlRail with FloatingControlRail**

- [ ] **Step 5: Verify build compiles + commit**

---

### Task 18: Restructure MetabolicEngPage to tabbed layout

**Files:**
- Modify: `src/components/tools/MetabolicEngPage.tsx` (PathDPage wraps this with `embedded` prop)

- [ ] **Step 1: Add tab state and definitions**

```tsx
const TABS: ToolTab[] = [
  { id: '3d-lab', label: '3D Lab', accent: PATHD_THEME.sky },
  { id: 'node-panel', label: 'Node Panel', accent: PATHD_THEME.lilac },
  { id: 'dbtl', label: 'DBTL', accent: PATHD_THEME.apricot },
  { id: 'evidence', label: 'Evidence', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 2: Make ThreeScene/FluidSim the default tab**

- [ ] **Step 3: Move NodePanel and DBTL into separate tabs**

- [ ] **Step 4: Verify build compiles + commit**

---

## Phase 7: NEXAI Sidebar

### Task 19: Create NEXAI sidebar component

**Files:**
- Create: `src/components/tools/nexai/AxonSidebar.tsx`
- Modify: `src/components/ide/CopilotSlideOver.tsx` (or replace)

- [ ] **Step 1: Create AxonSidebar component**

A 380px right sidebar with:
- Prompt input at top
- Chat thread (conversation-style, scrollable)
- Quick action buttons at bottom
- Open/close via ⌘K or NEXAI button

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles } from 'lucide-react';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

interface AxonSidebarProps {
  open: boolean;
  onClose: () => void;
  onSend: (query: string) => void;
  messages: Array<{ role: 'user' | 'axon'; content: string }>;
  loading: boolean;
}

export default function AxonSidebar({ open, onClose, onSend, messages, loading }: AxonSidebarProps) {
  const [query, setQuery] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    if (!query.trim()) return;
    onSend(query.trim());
    setQuery('');
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '380px',
            background: PATHD_THEME.sepiaPanel,
            borderLeft: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={14} color={PATHD_THEME.sky} />
              <span style={{ fontFamily: T.SANS, fontSize: '13px', fontWeight: 600, color: PATHD_THEME.value }}>
                Axon Copilot
              </span>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={16} color={PATHD_THEME.label} />
            </button>
          </div>

          {/* Thread */}
          <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user' ? 'rgba(175,195,214,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(175,195,214,0.25)' : 'rgba(255,255,255,0.06)'}`,
                fontFamily: T.SANS,
                fontSize: '12px',
                lineHeight: 1.6,
                color: PATHD_THEME.value,
              }}>
                {msg.content}
              </div>
            ))}
            {loading && (
              <div style={{ fontFamily: T.MONO, fontSize: '11px', color: PATHD_THEME.label, padding: '8px' }}>
                Axon is thinking...
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ padding: '8px 16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['Summarize', 'Next Step', 'Evidence Check'].map((action) => (
              <button key={action} style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '10px',
                fontFamily: T.SANS,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid rgba(255,255,255,0.08)`,
                color: PATHD_THEME.label,
                cursor: 'pointer',
              }}>
                {action}
              </button>
            ))}
          </div>

          {/* Prompt */}
          <div style={{
            padding: '12px 16px',
            borderTop: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
            display: 'flex',
            gap: '8px',
          }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask Axon anything..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '10px',
                background: PATHD_THEME.panelInset,
                border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                color: PATHD_THEME.value,
                fontFamily: T.SANS,
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <button onClick={handleSend} style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'rgba(175,195,214,0.2)',
              border: `1px solid rgba(175,195,214,0.3)`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}>
              <Send size={14} color={PATHD_THEME.sky} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Wire AxonSidebar into ToolsLayoutShell**

Import and render `AxonSidebar` in `ToolsLayoutShell.tsx`, connected to the Axon orchestrator provider.

- [ ] **Step 3: Add ⌘K keyboard shortcut**

Add a `useEffect` listener for `Cmd+K` / `Ctrl+K` to toggle the sidebar.

- [ ] **Step 4: Verify build compiles + commit**

```bash
git add src/components/tools/nexai/AxonSidebar.tsx src/components/ide/ToolsLayoutShell.tsx
git commit -m "feat: add NEXAI Axon sidebar (GitHub Copilot style)"
```

---

## Final Verification

### Task 20: Full build verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 2: Run Next.js build**

Run: `npx next build`
Expected: Build succeeds

- [ ] **Step 3: Run dev server and visual check**

Run: `npm run dev`
Open: `http://localhost:3000/tools/fbasim`
Verify: Tab bar visible, floating control rail visible, inline metrics visible, hero collapsed by default

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: complete workbench & tool page layout redesign"
git push origin main
```
