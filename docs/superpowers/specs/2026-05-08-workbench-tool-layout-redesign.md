# Workbench & Tool Page Layout Redesign

**Date:** 2026-05-08
**Status:** Approved
**Scope:** WorkbenchStatusBar restructure + 10 tool page content layouts
**Excluded:** DBTLflowPage, GECAIRPage, ProEvolPage (forbidden — cannot modify)

---

## 1. Design Direction

**Aesthetic:** Precision Laboratory — dark observatory where the visualization IS the interface, controls are peripheral, and data flows like light through a microscope.

**Core principles:**
1. Visualization-first — main chart/3D view takes 70%+ of viewport
2. Collapsible by default — hero, parameters, secondary views start collapsed
3. Tab-switched content — views organized as tabs, not scrollable sections
4. Floating control rail — parameters in a narrow left rail (200px)
5. Inline results — output metrics as overlays on the visualization

---

## 2. WorkbenchStatusBar Restructure

### Current (4 rows + 13-section drawer):
```
Row 1: Stage Rail [Stage1] [Stage2] [Stage3] [Stage4]
Row 2: 4 info cards (Current Object, Evidence, Stage Focus, Integrity)
Row 3: Golden Path Dashboard (6 tool chips + progress)
Row 4: Next Step indicator
Drawer: 13+ separate sections (Feedback, Integrity, Canonical, Evidence, etc.)
```

### Proposed (1 row + 3-tab drawer):
```
Single Row:
┌─────────────────────────────────────────────────────────────────┐
│ [S1][S2][S3][S4] │ Artemisinin · 7 nodes · stage 1 │ [🔬][📊][Axon][⋯] │
│                   │ ✓ fresh · next: PATHD · 1/6     │                    │
└─────────────────────────────────────────────────────────────────┘

Left:  Stage Rail (compact pill buttons, active highlighted)
Center: Project summary + status chips (fresh/next/progress)
Right: Action buttons (Research, Analyze, Axon, overflow)

Drawer: 3 tabs
┌─────────────────────────────────────────┐
│  [Status]  [Evidence]  [History]        │
├─────────────────────────────────────────┤
│  Tab content (glass panels, staggered)  │
└─────────────────────────────────────────┘
```

**Tab contents:**

| Tab | Sections |
|-----|----------|
| **Status** | Feedback (DBTL pass rate), Integrity (fresh/stale + DB sync), Canonical (runs/revision), Gate (next step blocker) |
| **Evidence** | Selected evidence list, Analyze artifact summary, Evidence trace links |
| **History** | Audit timeline, Run artifacts, Sync log |

**Removed:**
- 4 separate info cards → consolidated into center summary line
- Golden Path Dashboard → folded into status chips
- Next Step duplicate → appears once (gate chip or Status tab)
- 13 drawer sections → collapsed into 3 tabs

---

## 3. Tool Page Content Layout Pattern

All 10 modifiable tool pages follow this structure:

```
┌──────────────────────────────────────────────────────────────┐
│  WorkbenchStatusBar (1-row + tabbed drawer)                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Collapsed Hero (28px) ────────────────────────────────┐  │
│  │  ToolName · Description · key metric  [▸ expand]       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ View Tabs ────────────────────────────────────────────┐  │
│  │  [Tab1]  [Tab2]  [Tab3]  [Tab4]                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Floating Rail ─┐  ┌─ Main Visualization ─────────────┐  │
│  │  Controls        │  │                                    │  │
│  │  ────────        │  │   Primary chart/3D view             │  │
│  │  Parameter       │  │   fills remaining space             │  │
│  │  sliders         │  │                                    │  │
│  │                  │  │   ┌──────────┐                     │  │
│  │  [Action btn]    │  │   │ metric   │  ← inline overlay  │  │
│  │                  │  │   └──────────┘                     │  │
│  └──────────────────┘  └────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Collapsed hero** contains:
- Tool name + description + key signal
- Expand arrow → reveals ScientificHero full content + AlgorithmInsight + ScientificMethodStrip + DemoBanner
- Export button in action bar

**View tabs** replace vertical scrolling — each tab shows one visualization/analysis view.

**Floating control rail** (200px):
- Parameter sliders
- Action buttons (Run, Design, etc.)
- Mode toggles
- Collapsible via chevron

**Inline metric overlays** float on the main visualization:
- Growth rate, titer, confidence, etc.
- Semi-transparent glass background
- Positioned top-right or bottom-right of the viz area

---

## 4. Per-Tool Specific Designs

### 4.1 FBASim — "Flux Cartographer"

**Tabs:** Flux Map (default) | Knockout | Shadow Prices | Community

**Rail:** Glucose slider, O₂ slider, Objective radio (biomass/ATP/product), Run button

**Main viz (Flux Map tab):** Force-directed metabolic network SVG with flux-width edges, arrow markers, subsystem region labels, inline biomass overlay

**Main viz (Knockout tab):** Same network with knockout toggle buttons overlaid

**Main viz (Shadow Prices tab):** Table of shadow prices with bar chart visualization

**Main viz (Community tab):** Two StrainPanel side-by-side + SharedMetaboliteBus between them

**Inline overlays:** Growth rate, ATP yield, carbon efficiency

### 4.2 DynCon — "Control Observatory"

**Tabs:** Trajectory (default) | Hill Curve | Convergence | RBS Bridge

**Rail:** PID gains (Kp, Ki, Kd), Setpoint, Hill params (Vmax, Kd, n)

**Main viz (Trajectory tab):** 6-lane time-series SVG with setpoint band, confidence bands, phase portrait inset

**Main viz (Hill Curve tab):** Hill feedback curve with operating point marker

**Main viz (Convergence tab):** Convergence stats (settling time, overshoot, oscillation count)

**Main viz (RBS Bridge tab):** RBS part mapping, DNA sequence, strength bar

**Inline overlays:** Stability status, product titer, RMSE

### 4.3 CellFree — "Reactor Laboratory"

**Tabs:** Time Course (default) | Resources | Fitting | IVIV | Reactor 3D

**Rail:** Gene construct parameters, concentration sliders, Design/Run buttons

**Main viz (Time Course tab):** Tri-panel: ODE protein curves + resource depletion stacked area + radar construct performance

**Main viz (Resources tab):** Full resource depletion chart (5 series)

**Main viz (Fitting tab):** Michaelis-Menten fit with residual plot

**Main viz (IVIV tab):** In vitro-in vivo bar chart + correction factors + confidence gauge

**Main viz (Reactor 3D tab):** Reactor twin SVG schematic

### 4.4 CETHX — "Thermodynamic Cascade"

**Tabs:** Waterfall (default) | ATP Ledger | Feasibility

**Rail:** Pathway step toggles, temperature input

**Main viz:** Breathing waterfall ΔG cascade with energy landscape spline + ATP highlights

### 4.5 CATDES — "Catalyst Architect"

**Tabs:** 3D Viewer (default) | Binding | Sequences | Pareto | Mutagenesis

**Rail:** Enzyme dropdown, Substrate selector, Design button

**Main viz (3D Viewer tab):** CatalystViewer3D with residue click interaction

**Main viz (Binding tab):** Binding affinity radar chart

**Main viz (Sequences tab):** Designed sequences table

**Main viz (Pareto tab):** Multi-objective Pareto front scatter

**Main viz (Mutagenesis tab):** Mutagenesis targeting heatmap

### 4.6 GenMIM — "Genome Sculptor"

**Tabs:** Genome Map (default) | Targets | Schedule | Efficiency

**Rail:** Efficiency threshold slider, Essential gene visibility toggle, Run button

**Main viz:** Circular genome ideogram with gene arcs + CRISPRi suppression overlay

### 4.7 MultiO — "Omics Observatory"

**Tabs:** Embedding (default) | Volcano | Factors | Projection | Efficiency

**Rail:** Layer filter (All/RNA/Protein/Metabolite), Train button

**Main viz (Embedding tab):** UMAP scatter with per-layer convex hull halos

### 4.8 NEXAI — "Axon Copilot" (Sidebar Design)

**Design:** Sidebar/slide-over panel (like GitHub Copilot), NOT a full-page layout.

**Layout:**
```
┌────────────────────────┬──────────────────────────────────────┐
│  NEXAI Sidebar (380px) │  Current Tool Page Content           │
│                        │  (whatever tool the user is on)      │
│  ┌─ Prompt ──────────┐ │                                      │
│  │ Ask Axon...  [▸]  │ │                                      │
│  └────────────────────┘ │                                      │
│                        │                                      │
│  ┌─ Chat Thread ─────┐ │                                      │
│  │ User: question     │ │                                      │
│  │                    │ │                                      │
│  │ Axon: answer with  │ │                                      │
│  │ citation chips,    │ │                                      │
│  │ inline evidence,   │ │                                      │
│  │ tool routing hints │ │                                      │
│  │                    │ │                                      │
│  │ [View Evidence]    │ │                                      │
│  │ [View Raw Output]  │ │                                      │
│  │ [Route to Tool ▸]  │ │                                      │
│  └────────────────────┘ │                                      │
│                        │                                      │
│  ┌─ Quick Actions ───┐ │                                      │
│  │ [Summarize]        │ │                                      │
│  │ [Next Step]        │ │                                      │
│  │ [Evidence Check]   │ │                                      │
│  └────────────────────┘ │                                      │
│                        │                                      │
└────────────────────────┴──────────────────────────────────────┘
```

**Behavior:**
- Opens as a right sidebar (380px width) via ⌘K or clicking NEXAI in the sidebar
- Overlays the current tool page — user can see the tool content behind it
- Chat thread scrolls vertically (conversation-style)
- Each Axon response includes: answer text, citation chips, evidence links, tool routing buttons
- "Route to Tool" button navigates to the recommended tool with context pre-filled
- Quick action buttons for common queries (summarize, next step, evidence check)
- Can be dismissed/resized, state persists across tool navigation
- Works from ANY tool page (not just /tools/nexai route)

**Changes:**
- `/tools/nexai` route still exists as a full page for deep research sessions
- The sidebar is a global component available from all tool pages
- The sidebar replaces the current `CopilotSlideOver` component

### 4.9 ScSpatial — "Spatial Atlas"

**Tabs:** Hex Grid (default) | UMAP | Clusters | Gene Expression

**Rail:** Cluster dropdown, Gene selector, Upload/Demo buttons

**Main viz:** 10x Visium hexagonal spot grid with cluster coloring

### 4.10 PathD — "Metabolic Laboratory"

**Tabs:** 3D Lab (default) | Node Panel | DBTL | Evidence

**No sidebar** — 3D canvas fills the space.

**Main viz (3D Lab tab):** ThreeScene + FluidSim interactive pathway

**Main viz (Node Panel tab):** 3-tab scientific workbench (Overview/Structure/Analysis)

---

## 5. Shared Component Changes

### Components to modify:

| Component | Change |
|-----------|--------|
| `ScientificHero` | Default collapsed (28px lineage bar). Click to expand full content. |
| `ScientificFigureFrame` | Remove wrapper — content goes directly in tab panel |
| `ScientificMethodStrip` | Move into collapsed hero expand section |
| `AlgorithmInsight` | Move into collapsed hero expand section |
| `DemoBanner` | Convert to inline status chip in hero bar |
| `SimErrorBanner` | Convert to inline alert chip in hero bar |
| `WorkbenchInlineContext` | Merge into collapsed hero summary line |
| `MetricCard` | Convert to floating overlay on visualization |
| `ExportButton` | Move to hero action bar (top-right) |
| `ToolShell` | Add tab infrastructure (tab bar, tab content panels) |

### New shared components to create:

| Component | Purpose |
|-----------|---------|
| `ToolTabBar` | Tab navigation with active indicator animation |
| `ToolTabPanel` | Tab content panel with AnimatePresence transitions |
| `FloatingControlRail` | Narrow left sidebar for parameter controls |
| `InlineMetricOverlay` | Floating metric display on visualization |

---

## 6. Animation Specification

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Tab switch | fade + slide 8px up | 300ms | ease-out |
| Tab indicator | width + transform slide | 250ms | ease-in-out |
| Hero expand/collapse | height auto + opacity | 350ms | ease-in-out |
| Control rail collapse | width transition | 250ms | ease-in-out |
| Metric overlay appear | opacity fade | 200ms | ease-out |
| Card stagger (drawer) | fade + slide 8px | 300ms + 60ms stagger | ease-out |
| Floating rail items | fade + slide 4px | 200ms + 40ms stagger | ease-out |

All animations use Framer Motion (already in dependencies: `^12.38.0`).

---

## 7. Design Tokens (Existing)

All components use existing tokens from:
- `PATHD_THEME` — colors, borders, surfaces
- `T` (from `tokens.ts`) — typography (Public Sans, IBM Plex Mono, Space Grotesk)
- `workbenchDesignSystem.ts` — glass panels, animations, status chips

No new color palette or typography changes needed.

---

## 8. Implementation Order

1. **Phase 1:** Shared components (`ToolTabBar`, `ToolTabPanel`, `FloatingControlRail`, `InlineMetricOverlay`)
2. **Phase 2:** `ScientificHero` collapse default + `ToolShell` tab infrastructure
3. **Phase 3:** `WorkbenchStatusBar` restructure (1-row + 3-tab drawer)
4. **Phase 4:** Tool page layouts (Group A: FBASim, DynCon, CellFree, CETHX)
5. **Phase 5:** Tool page layouts (Group B: CATDES, GenMIM, MultiO)
6. **Phase 6:** Tool page layouts (Group C: ScSpatial, PathD)
7. **Phase 7:** NEXAI sidebar (replace CopilotSlideOver with Axon sidebar)

---

## 9. Files to Modify

### Shared:
- `src/components/tools/shared/ScientificHero.tsx`
- `src/components/tools/shared/ScientificFigureFrame.tsx`
- `src/components/tools/shared/ScientificMethodStrip.tsx`
- `src/components/tools/shared/ToolShell.tsx`
- `src/components/ide/shared/AlgorithmInsight.tsx`
- `src/components/ide/shared/DemoBanner.tsx`
- `src/components/ide/shared/SimErrorBanner.tsx`
- `src/components/ide/shared/MetricCard.tsx`
- `src/components/workbench/WorkbenchInlineContext.tsx`
- `src/components/workbench/WorkbenchStatusBar.tsx`

### New:
- `src/components/tools/shared/ToolTabBar.tsx`
- `src/components/tools/shared/ToolTabPanel.tsx`
- `src/components/tools/shared/FloatingControlRail.tsx`
- `src/components/tools/shared/InlineMetricOverlay.tsx`

### Tool pages:
- `src/components/tools/FBASimPage.tsx`
- `src/components/tools/DynConPage.tsx`
- `src/components/tools/CellFreePage.tsx`
- `src/components/tools/CETHXPage.tsx`
- `src/components/tools/CatalystDesignerPage.tsx`
- `src/components/tools/GenMIMPage.tsx`
- `src/components/tools/MultiOPage.tsx`
- `src/components/tools/NEXAIPage.tsx` (sidebar design, not full-page tabs)
- `src/components/tools/ScSpatialPage.tsx`
- `src/components/tools/PathDPage.tsx` (or MetabolicEngPage.tsx)

### NEXAI sidebar:
- `src/components/ide/CopilotSlideOver.tsx` (replace with new sidebar)
- `src/components/ide/AxonLogPanel.tsx`
- `src/components/ide/AxonPlanPanel.tsx`
- `src/components/ide/AgentSessionViewer.tsx`

### Design system:
- `src/components/workbench/workbenchDesignSystem.ts` (add new exports)

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Tab state lost on navigation | Persist active tab per tool in `uiStore` or `localStorage` |
| 3D viewer performance in tabs | Use `display:none` instead of unmounting for Three.js/3Dmol |
| Mobile responsiveness | Rail collapses to bottom sheet on narrow viewports |
| Accessibility | Tab panels use proper `role="tablist"` / `role="tab"` / `role="tabpanel"` ARIA |
| Forbidden pages | Never modify DBTLflowPage, GECAIRPage, ProEvolPage |
