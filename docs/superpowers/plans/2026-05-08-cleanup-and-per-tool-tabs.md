# Cleanup Redundant Panels + Per-Tool Tabs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant context panels from all tool pages and convert generic viz/analysis tabs to tool-specific tabs per the design doc.

**Architecture:** Remove WorkbenchInlineContext, ScientificMethodStrip, AlgorithmInsight, DemoBanner from all tool pages (top bar handles this). Each tool's viewMode dropdown becomes first-class ToolTabBar tabs (4-5 per tool). FloatingControlRail keeps parameters only.

**Tech Stack:** React 19, TypeScript, Next.js 15, Framer Motion 12, inline styles

**Spec:** `docs/superpowers/specs/2026-05-08-workbench-tool-layout-redesign.md`

---

## File Structure

### Files to modify (per tool):
- `src/components/tools/DynConPage.tsx` — remove 4 redundant imports + JSX, convert tabs
- `src/components/tools/CellFreePage.tsx` — convert viewMode dropdown → tabs
- `src/components/tools/CatalystDesignerPage.tsx` — convert viewMode dropdown → tabs
- `src/components/tools/MultiOPage.tsx` — convert viewMode dropdown → tabs
- `src/components/tools/FBASimPage.tsx` — convert viz/analysis → tool-specific tabs
- `src/components/tools/CETHXPage.tsx` — convert viz/analysis → tool-specific tabs
- `src/components/tools/GenMIMPage.tsx` — convert viz/analysis → tool-specific tabs
- `src/components/tools/ScSpatialPage.tsx` — convert viz/insights → tool-specific tabs
- `src/components/tools/MetabolicEngPage.tsx` — convert Lab/Analysis → tool-specific tabs

---

### Task 1: DynConPage — cleanup + per-tool tabs

**Files:**
- Modify: `src/components/tools/DynConPage.tsx`

**Current state:** Has 4 redundant component imports (AlgorithmInsight, DemoBanner, WorkbenchInlineContext, ScientificMethodStrip). Has generic viz/analysis tabs.

**Target tabs:** Trajectory | Hill Curve | Convergence | RBS Bridge

- [ ] **Step 1: Remove redundant imports**

Remove these import lines:
```tsx
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import DemoBanner from '../ide/shared/DemoBanner';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
```

- [ ] **Step 2: Remove redundant JSX usage**

Search for and remove all JSX that renders these components (AlgorithmInsight, DemoBanner, WorkbenchInlineContext, ScientificMethodStrip) from the return block.

- [ ] **Step 3: Replace tab definitions**

Replace:
```tsx
const DYNCON_TABS: ToolTab[] = [
  { id: 'viz', label: 'Visualization', accent: PATHD_THEME.sky },
  { id: 'analysis', label: 'Analysis', accent: PATHD_THEME.mint },
];
```

With:
```tsx
const DYNCON_TABS: ToolTab[] = [
  { id: 'trajectory', label: 'Trajectory', accent: PATHD_THEME.sky },
  { id: 'hill', label: 'Hill Curve', accent: PATHD_THEME.lilac },
  { id: 'convergence', label: 'Convergence', accent: PATHD_THEME.apricot },
  { id: 'rbs', label: 'RBS Bridge', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 4: Update activeTab default**

Change `useState('viz')` to `useState('trajectory')`.

- [ ] **Step 5: Split viz content into tab panels**

Replace the single `<ToolTabPanel tabId="viz">` with 4 separate ToolTabPanels, one per tab. Each renders the relevant visualization content. The analysis tab content (MetricCards, etc.) gets distributed into the appropriate tab (e.g., convergence stats go in the Convergence tab).

- [ ] **Step 6: Add InlineMetricOverlay to each tab**

Each tab gets its own InlineMetricOverlay with metrics relevant to that view.

- [ ] **Step 7: Verify build + commit**

Run: `npx tsc --noEmit --pretty`
Expected: clean compile

```bash
git add src/components/tools/DynConPage.tsx
git commit -m "[proevol] DynConPage: cleanup + per-tool tabs (Trajectory/Hill/Convergence/RBS)"
```

---

### Task 2: CellFreePage — convert viewMode dropdown to tabs

**Files:**
- Modify: `src/components/tools/CellFreePage.tsx`

**Current state:** Has generic viz/analysis tabs. Has `viewMode` state with dropdown in FloatingControlRail switching between TimeCourse/Resources/Fitting/IvIv/Reactor3D views.

**Target tabs:** Time Course | Resources | Fitting | IVIV | Reactor 3D

- [ ] **Step 1: Replace tab definitions**

Replace CELLFREE_TABS with:
```tsx
const CELLFREE_TABS: ToolTab[] = [
  { id: 'timecourse', label: 'Time Course', accent: PATHD_THEME.sky },
  { id: 'resources', label: 'Resources', accent: PATHD_THEME.lilac },
  { id: 'fitting', label: 'Fitting', accent: PATHD_THEME.apricot },
  { id: 'iviv', label: 'IVIV', accent: PATHD_THEME.mint },
  { id: 'reactor', label: 'Reactor 3D', accent: PATHD_THEME.coral },
];
```

- [ ] **Step 2: Remove viewMode state and dropdown**

Remove `const [viewMode, setViewMode] = useState<ViewMode>('TimeCourse')` and the ViewMode type. Remove the view mode dropdown from FloatingControlRail.

- [ ] **Step 3: Split viz content into 5 tab panels**

Each `if (viewMode === 'X')` block becomes its own `<ToolTabPanel tabId="x">`. The ScientificFigureFrame wraps each tab's content.

- [ ] **Step 4: Update activeTab default + verify build + commit**

Change default to `'timecourse'`. Verify clean compile.

```bash
git add src/components/tools/CellFreePage.tsx
git commit -m "[proevol] CellFreePage: convert viewMode dropdown to per-tool tabs"
```

---

### Task 3: CatalystDesignerPage — convert viewMode dropdown to tabs

**Files:**
- Modify: `src/components/tools/CatalystDesignerPage.tsx`

**Current state:** Has 3D Viewport / Analysis tabs. Analysis tab has sub-tabs for VIEW_MODES (Binding, Sequences, FluxCost, Balancer, Pareto, Mutagenesis).

**Target tabs:** 3D Viewer | Binding | Sequences | Pareto | Mutagenesis

- [ ] **Step 1: Replace tab definitions**

```tsx
const CATDES_TABS: ToolTab[] = [
  { id: 'viewer', label: '3D Viewer', accent: PATHD_THEME.sky },
  { id: 'binding', label: 'Binding', accent: PATHD_THEME.lilac },
  { id: 'sequences', label: 'Sequences', accent: PATHD_THEME.apricot },
  { id: 'pareto', label: 'Pareto', accent: PATHD_THEME.mint },
  { id: 'mutagenesis', label: 'Mutagenesis', accent: PATHD_THEME.coral },
];
```

- [ ] **Step 2: Remove viewMode state and sub-tab dropdown**

Remove the VIEW_MODES array, viewMode state, and the sub-tab selector from the Analysis tab.

- [ ] **Step 3: Split content into 5 tab panels**

3D Viewer tab: CatalystViewer3D + FloatingControlRail (enzyme selector, substrate, render mode, spin toggle)
Binding tab: binding affinity radar chart
Sequences tab: designed sequences table
Pareto tab: Pareto front scatter
Mutagenesis tab: mutagenesis targeting heatmap

- [ ] **Step 4: Verify build + commit**

```bash
git add src/components/tools/CatalystDesignerPage.tsx
git commit -m "[proevol] CatalystDesignerPage: convert to per-tool tabs (3D/Binding/Sequences/Pareto/Mutagenesis)"
```

---

### Task 4: MultiOPage — convert viewMode dropdown to tabs

**Files:**
- Modify: `src/components/tools/MultiOPage.tsx`

**Current state:** Has generic viz/analysis tabs. Has `viewMode` state with dropdown in FloatingControlRail switching between Embedding/Volcano/Table/Factors/Latent/Efficiency views.

**Target tabs:** Embedding | Volcano | Factors | Projection | Efficiency

- [ ] **Step 1: Replace tab definitions**

```tsx
const MULTIO_TABS: ToolTab[] = [
  { id: 'embedding', label: 'Embedding', accent: PATHD_THEME.sky },
  { id: 'volcano', label: 'Volcano', accent: PATHD_THEME.lilac },
  { id: 'factors', label: 'Factors', accent: PATHD_THEME.apricot },
  { id: 'projection', label: 'Projection', accent: PATHD_THEME.mint },
  { id: 'efficiency', label: 'Efficiency', accent: PATHD_THEME.coral },
];
```

- [ ] **Step 2: Remove viewMode state and dropdown from rail**

Remove ViewMode type, VIEW_MODE_LABELS, viewMode state, and the view mode selector buttons from FloatingControlRail.

- [ ] **Step 3: Split viz content into 5 tab panels**

Each `if (viewMode === 'X')` block becomes its own ToolTabPanel. The analysis tab content (enrichment MetricCards, layer signal analysis, cross-layer correlations) gets distributed into the appropriate tabs.

- [ ] **Step 4: Verify build + commit**

```bash
git add src/components/tools/MultiOPage.tsx
git commit -m "[proevol] MultiOPage: convert viewMode dropdown to per-tool tabs"
```

---

### Task 5: FBASimPage — convert viz/analysis to tool-specific tabs

**Files:**
- Modify: `src/components/tools/FBASimPage.tsx`

**Current state:** Has generic viz/analysis tabs.

**Target tabs:** Flux Map | Knockout | Shadow Prices | Community

- [ ] **Step 1: Replace tab definitions**

```tsx
const FBA_TABS: ToolTab[] = [
  { id: 'flux', label: 'Flux Map', accent: PATHD_THEME.sky },
  { id: 'knockout', label: 'Knockout', accent: PATHD_THEME.lilac },
  { id: 'shadow', label: 'Shadow Prices', accent: PATHD_THEME.apricot },
  { id: 'community', label: 'Community', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 2: Split viz content into 4 tab panels**

Flux Map: main metabolic network SVG
Knockout: network with knockout toggles
Shadow Prices: shadow price table/chart
Community: two StrainPanel side-by-side

- [ ] **Step 3: Verify build + commit**

```bash
git add src/components/tools/FBASimPage.tsx
git commit -m "[proevol] FBASimPage: convert to per-tool tabs (Flux/Knockout/Shadow/Community)"
```

---

### Task 6: CETHXPage — convert viz/analysis to tool-specific tabs

**Files:**
- Modify: `src/components/tools/CETHXPage.tsx`

**Current state:** Has generic viz/analysis tabs.

**Target tabs:** Waterfall | ATP Ledger | Feasibility

- [ ] **Step 1: Replace tab definitions**

```tsx
const CETHX_TABS: ToolTab[] = [
  { id: 'waterfall', label: 'Waterfall', accent: PATHD_THEME.sky },
  { id: 'atp', label: 'ATP Ledger', accent: PATHD_THEME.lilac },
  { id: 'feasibility', label: 'Feasibility', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 2: Split content into 3 tab panels**

Waterfall: BreathingWaterfall ΔG cascade
ATP Ledger: ATP/NADH yield breakdown
Feasibility: efficiency gauge + step breakdown

- [ ] **Step 3: Verify build + commit**

```bash
git add src/components/tools/CETHXPage.tsx
git commit -m "[proevol] CETHXPage: convert to per-tool tabs (Waterfall/ATP/Feasibility)"
```

---

### Task 7: GenMIMPage — convert viz/analysis to tool-specific tabs

**Files:**
- Modify: `src/components/tools/GenMIMPage.tsx`

**Current state:** Has generic viz/analysis tabs.

**Target tabs:** Genome Map | Targets | Schedule | Efficiency

- [ ] **Step 1: Replace tab definitions**

```tsx
const GENMIM_TABS: ToolTab[] = [
  { id: 'genome', label: 'Genome Map', accent: PATHD_THEME.sky },
  { id: 'targets', label: 'Targets', accent: PATHD_THEME.lilac },
  { id: 'schedule', label: 'Schedule', accent: PATHD_THEME.apricot },
  { id: 'efficiency', label: 'Efficiency', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 2: Split content into 4 tab panels**

Genome Map: GenomeMap SVG + table
Targets: full target table
Schedule: CRISPRi schedule list
Efficiency: efficiency metrics + heatmap

- [ ] **Step 3: Verify build + commit**

```bash
git add src/components/tools/GenMIMPage.tsx
git commit -m "[proevol] GenMIMPage: convert to per-tool tabs (Genome/Targets/Schedule/Efficiency)"
```

---

### Task 8: ScSpatialPage — convert viz/insights to tool-specific tabs

**Files:**
- Modify: `src/components/tools/ScSpatialPage.tsx`

**Current state:** Has viz/insights tabs.

**Target tabs:** Hex Grid | UMAP | Clusters | Gene Expression

- [ ] **Step 1: Replace tab definitions**

```tsx
const SCSPATIAL_TABS: ToolTab[] = [
  { id: 'hexgrid', label: 'Hex Grid', accent: PATHD_THEME.sky },
  { id: 'umap', label: 'UMAP', accent: PATHD_THEME.lilac },
  { id: 'clusters', label: 'Clusters', accent: PATHD_THEME.apricot },
  { id: 'expression', label: 'Gene Expression', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 2: Split content into 4 tab panels**

Each view mode from ScSpatialViewport becomes its own tab. The viewport's internal viewMode switching gets replaced by tab-driven rendering.

- [ ] **Step 3: Verify build + commit**

```bash
git add src/components/tools/ScSpatialPage.tsx
git commit -m "[proevol] ScSpatialPage: convert to per-tool tabs (HexGrid/UMAP/Clusters/Expression)"
```

---

### Task 9: MetabolicEngPage — convert Lab/Analysis to tool-specific tabs

**Files:**
- Modify: `src/components/tools/MetabolicEngPage.tsx`

**Current state:** Has floating Lab/Analysis tabs over 3D canvas. Analysis tab shows support frame with WorkbenchInlineContext, ScientificHero, ScientificMethodStrip.

**Target tabs:** 3D Lab | Node Panel | DBTL | Evidence

- [ ] **Step 1: Remove redundant components from Analysis tab**

Remove WorkbenchInlineContext, ScientificMethodStrip from the Analysis tab content. Keep ScientificHero (signals only).

- [ ] **Step 2: Replace tab definitions**

```tsx
const PATHD_TABS: ToolTab[] = [
  { id: 'lab', label: '3D Lab', accent: PATHD_THEME.sky },
  { id: 'node', label: 'Node Panel', accent: PATHD_THEME.lilac },
  { id: 'dbtl', label: 'DBTL', accent: PATHD_THEME.apricot },
  { id: 'evidence', label: 'Evidence', accent: PATHD_THEME.mint },
];
```

- [ ] **Step 3: Wire up tab content**

3D Lab: existing 3D canvas + overlays (default)
Node Panel: NodePanel component (shown when a node is selected)
DBTL: DBTL integration panel
Evidence: evidence trace from workbench store

- [ ] **Step 4: Verify build + commit**

```bash
git add src/components/tools/MetabolicEngPage.tsx
git commit -m "[proevol] MetabolicEngPage: convert to per-tool tabs (Lab/Node/DBTL/Evidence)"
```

---

### Task 10: Full build verification

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: clean compile

- [ ] **Step 2: Next.js build**

Run: `npx next build`
Expected: all routes compile, no warnings

- [ ] **Step 3: Commit and push**

```bash
git push origin main
```
