# Chart Redesign — Nature/Science Journal Style

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all tool page charts from "cartoonish dark glass" to Nature/Science journal style — white chart canvases, thin precise lines, serif annotations, high data-ink ratio, no glassmorphism.

**Architecture:** Create a new `PAPER_THEME` token set in `chartTheme.ts` that overrides the dark chart tokens with paper-style equivalents. Update `SVGChartContainer` to support light backgrounds. Then update each tool page's chart components to use the new tokens. UI panels (non-chart) get reduced border-radius and removed glassmorphism.

**Tech Stack:** SVG (hand-rolled), Recharts, Three.js, existing `chartTheme.ts` token system

---

## Design Spec — Nature/Science Journal Chart Style

### Chart Canvas (SVG area)
- **Background:** `#FAFAF8` (warm white, like paper)
- **Border:** `1px solid #E0DDD8` (subtle warm gray)
- **Border radius:** `2px` (nearly sharp, like a printed figure)
- **Grid lines:** `#E8E5E0`, `stroke-width: 0.5`, no dash
- **Axis lines:** `#888`, `stroke-width: 0.75`
- **Tick labels:** `'IBM Plex Mono', monospace`, `10px`, `#666`
- **Axis titles:** `'Public Sans', sans-serif`, `11px`, `#444`, `font-weight: 600`
- **Figure labels (a, b, c):** `'Public Sans', sans-serif`, `13px`, `#222`, `font-weight: 700`

### Data Encoding
- **Primary lines:** `stroke-width: 1.5`, solid
- **Secondary/muted lines:** `stroke-width: 1.0`, solid
- **Confidence bands:** `fill-opacity: 0.15`, same color as line
- **Scatter points:** `r: 3`, `fill-opacity: 0.7`, `stroke: #333`, `stroke-width: 0.5`
- **Bar fills:** Use Okabe-Ito `SCI_PALETTE` (CVD-safe), `fill-opacity: 0.85`
- **Heatmap:** Diverging blue-white-red (standard scientific), not candy colors

### Color Palette (CVD-safe, Okabe-Ito)
Keep `SCI_PALETTE` as primary data colors — they're already CVD-safe:
- Blue `#56B4E9`, Orange `#E69F00`, Green `#009E73`, Vermilion `#D55E00`, Navy `#0072B2`, Magenta `#CC79A7`

Replace `SCI_PASTEL` (candy colors) with muted versions:
- `coral: '#D4886C'`, `periwinkle: '#7A9BC0'`, `teal: '#5BA3A5'`, `lavender: '#9B82BF'`

### Tooltip (on white charts)
- **Background:** `#FFFEF9` (warm white)
- **Border:** `1px solid #D0CDC8`
- **Border radius:** `4px`
- **No backdrop-filter** (no glassmorphism)
- **Shadow:** `0 2px 8px rgba(0,0,0,0.12)` (subtle)
- **Font:** `'IBM Plex Mono', monospace`, `11px`, `#333`

### UI Panels (non-chart, surrounding controls)
- **Border radius:** `6px` (reduced from 12-20px)
- **No backdrop-filter** (remove glassmorphism)
- **Background:** `rgba(17, 19, 24, 0.95)` (more opaque, less glassy)
- **Border:** `1px solid rgba(255,255,255,0.10)`
- **Shadow:** `0 2px 8px rgba(0,0,0,0.2)` (reduced)

### Legend
- **Position:** Inside chart area (top-right preferred), or below chart
- **Font:** `'Public Sans', sans-serif`, `10px`, `#555`
- **Box:** No border, no background, just text + small color swatch
- **Swatch:** `10x3px` rectangle (not circle, not rounded)

---

## File Structure

### Files to Modify

| File | Change |
|------|--------|
| `src/components/charts/chartTheme.ts` | Add `PAPER_THEME` tokens, update `TOOLTIP_STYLE`, `CHART_CONTAINER`, `SCATTER`, `LINE`, `BAND` |
| `src/components/charts/primitives/SVGChartContainer.tsx` | Add `variant: 'paper'` prop for white background |
| `src/components/tools/fbasim/FluxMap.tsx` | White canvas, thinner lines, muted subsystem colors |
| `src/components/tools/fbasim/CommunityPanels.tsx` | Remove glassmorphism from GlassContainer, update COLORS |
| `src/components/tools/MultiOPage.tsx` | White chart backgrounds, scientific palette |
| `src/components/tools/proevol/research/*.tsx` | Update Recharts theme to paper style |
| `src/components/tools/GECAIRPage.tsx` | White chart backgrounds |
| `src/components/tools/CatalystDesignerPage.tsx` | Update MiniBar, sparkline styles |
| `src/components/tools/GenMIMPage.tsx` | Update genome map styling |
| `src/components/tools/DynConPage.tsx` | Update time-series chart styling |
| `src/components/tools/CETHXPage.tsx` | Update waterfall chart styling |
| `src/components/tools/CellFreePage.tsx` | Update expression chart styling |
| `src/components/tools/NEXAIPage.tsx` | Update citation network styling |
| `src/components/tools/ScSpatialPage.tsx` | Update hex grid styling |
| `src/components/tools/MultiOPage.tsx` | Update all chart variants |

### Files to Create

| File | Purpose |
|------|---------|
| `docs/superpowers/specs/2026-06-12-chart-redesign-spec.md` | Design spec document |

---

## Task 1: Create Paper Theme Tokens in chartTheme.ts

**Files:**
- Modify: `src/components/charts/chartTheme.ts`

- [ ] **Step 1: Add PAPER_THEME export**

Add after the existing `SCI_PASTEL` export (around line 96):

```typescript
/**
 * Nature/Science journal paper-style chart tokens.
 * Use for chart SVG canvases — white background, thin lines, serif annotations.
 */
export const PAPER_THEME = {
  // Canvas
  bg: '#FAFAF8',
  bgAlt: '#F5F3EF',
  border: '#E0DDD8',
  borderRadius: 2,

  // Grid & axes
  grid: '#E8E5E0',
  gridWidth: 0.5,
  axis: '#888888',
  axisWidth: 0.75,

  // Typography
  tickFont: "'IBM Plex Mono', monospace",
  tickSize: 10,
  tickColor: '#666666',
  labelFont: "'Public Sans', sans-serif",
  labelSize: 11,
  labelColor: '#444444',
  titleFont: "'Public Sans', sans-serif",
  titleSize: 13,
  titleColor: '#222222',

  // Data
  linePrimary: 1.5,
  lineSecondary: 1.0,
  bandOpacity: 0.15,
  scatterR: 3,
  scatterFillOpacity: 0.7,
  scatterStroke: '#333333',
  scatterStrokeWidth: 0.5,
  barFillOpacity: 0.85,

  // Tooltip
  tooltipBg: '#FFFEF9',
  tooltipBorder: '#D0CDC8',
  tooltipRadius: 4,
  tooltipShadow: '0 2px 8px rgba(0,0,0,0.12)',
  tooltipColor: '#333333',

  // Legend
  legendFont: "'Public Sans', sans-serif",
  legendSize: 10,
  legendColor: '#555555',
  legendSwatchW: 10,
  legendSwatchH: 3,
} as const;
```

- [ ] **Step 2: Update TOOLTIP_STYLE to support paper variant**

Add a new export after `TOOLTIP_STYLE`:

```typescript
export const PAPER_TOOLTIP_STYLE: React.CSSProperties = {
  background: PAPER_THEME.tooltipBg,
  border: `1px solid ${PAPER_THEME.tooltipBorder}`,
  borderRadius: PAPER_THEME.tooltipRadius,
  padding: '6px 10px',
  boxShadow: PAPER_THEME.tooltipShadow,
  fontFamily: PAPER_THEME.tickFont,
  fontSize: PAPER_THEME.tickSize,
  color: PAPER_THEME.tooltipColor,
};
```

- [ ] **Step 3: Update CHART_CONTAINER**

Change `CHART_CONTAINER` from:
```typescript
export const CHART_CONTAINER: React.CSSProperties = {
  borderRadius: 20,
  overflow: 'hidden',
};
```
To:
```typescript
export const CHART_CONTAINER: React.CSSProperties = {
  borderRadius: PAPER_THEME.borderRadius,
  overflow: 'hidden',
};
```

- [ ] **Step 4: Add muted SCI_PASTEL replacement**

Add after `SCI_PASTEL`:

```typescript
/**
 * Muted pastel palette — replaces SCI_PASTEL for paper-style charts.
 * Same hue family but desaturated to match Nature/Science figure aesthetic.
 */
export const SCI_PASTEL_MUTED = {
  teal:       '#5BA3A5',
  lavender:   '#9B82BF',
  coral:      '#D4886C',
  periwinkle: '#7A9BC0',
  olive:      '#7FA362',
  pink:       '#C07A96',
  butter:     '#C4AD66',
  mauve:      '#A08878',
} as const;
```

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/chartTheme.ts
git commit -m "feat: add PAPER_THEME tokens for Nature/Science journal style charts"
```

---

## Task 2: Update SVGChartContainer for Paper Variant

**Files:**
- Modify: `src/components/charts/primitives/SVGChartContainer.tsx`

- [ ] **Step 1: Add variant prop**

Read the current file, then update the component to accept a `variant` prop:

```typescript
interface SVGChartContainerProps {
  W: number;
  H: number;
  children: React.ReactNode;
  fill?: string;
  rx?: number;
  variant?: 'dark' | 'paper';  // NEW
  className?: string;
  style?: React.CSSProperties;
}
```

- [ ] **Step 2: Apply paper theme defaults**

Update the destructuring and defaults:

```typescript
export function SVGChartContainer({
  W, H, children, fill, rx, variant = 'dark', className, style,
}: SVGChartContainerProps) {
  const isPaper = variant === 'paper';
  const resolvedFill = fill ?? (isPaper ? '#FAFAF8' : colors.bg.primary);
  const resolvedRx = rx ?? (isPaper ? 2 : 12);
  const resolvedBorder = isPaper ? '1px solid #E0DDD8' : undefined;

  return (
    <svg
      role="img"
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width: '100%',
        height: '100%',
        border: resolvedBorder,
        ...style,
      }}
      className={className}
    >
      <rect width={W} height={H} fill={resolvedFill} rx={resolvedRx} />
      {children}
    </svg>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/primitives/SVGChartContainer.tsx
git commit -m "feat: SVGChartContainer supports paper variant (white background)"
```

---

## Task 3: Update FluxMap to Paper Style

**Files:**
- Modify: `src/components/tools/fbasim/FluxMap.tsx`

- [ ] **Step 1: Update imports**

Change:
```typescript
import { SCI_PALETTE, SCI_PASTEL } from '../../charts/chartTheme';
```
To:
```typescript
import { SCI_PALETTE, SCI_PASTEL_MUTED, PAPER_THEME } from '../../charts/chartTheme';
```

- [ ] **Step 2: Update SUBSYSTEM_COLORS**

Change:
```typescript
export const SUBSYSTEM_COLORS: Record<string, string> = {
  Glycolysis:   SCI_PASTEL.coral,
  TCA:          SCI_PASTEL.periwinkle,
  Energy:       SCI_PASTEL.teal,
  Fermentation: SCI_PASTEL.lavender,
};
```
To:
```typescript
export const SUBSYSTEM_COLORS: Record<string, string> = {
  Glycolysis:   SCI_PASTEL_MUTED.coral,
  TCA:          SCI_PASTEL_MUTED.periwinkle,
  Energy:       SCI_PASTEL_MUTED.teal,
  Fermentation: SCI_PASTEL_MUTED.lavender,
};
```

- [ ] **Step 3: Update SVG background rect**

Find the `<rect>` that sets the chart background (the one with `fill="#05070b"` or similar). Change to:
```tsx
<rect width={W} height={viewH} fill={PAPER_THEME.bg} rx={PAPER_THEME.borderRadius} />
```

- [ ] **Step 4: Update edge labels and legend**

Search for any hardcoded `rgba(255,255,255,...)` fill colors in text elements. Change to `PAPER_THEME.tickColor` or `PAPER_THEME.labelColor`. Update the legend box background from dark to `PAPER_THEME.bgAlt`.

- [ ] **Step 5: Update grid/axis lines**

Search for stroke colors like `rgba(255,255,255,0.06)` in grid lines. Change to `PAPER_THEME.grid` with `strokeWidth={PAPER_THEME.gridWidth}`.

- [ ] **Step 6: Commit**

```bash
git add src/components/tools/fbasim/FluxMap.tsx
git commit -m "feat: FluxMap paper style — white canvas, muted subsystem colors"
```

---

## Task 4: Update CommunityPanels — Remove Glassmorphism

**Files:**
- Modify: `src/components/tools/fbasim/CommunityPanels.tsx`

- [ ] **Step 1: Update GlassContainer**

Find the `GlassContainer` component. Remove `backdropFilter` and `boxShadow`. Reduce `borderRadius` from `var(--nb-radius-xl)` to `6px`. Make background more opaque.

Change from:
```tsx
style={{
  background: 'rgba(31, 37, 44, 0.92)',
  border: `1px solid rgba(255,255,255,0.08)`,
  borderRadius: 'var(--nb-radius-xl)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  ...style,
}}
```
To:
```tsx
style={{
  background: 'rgba(17, 19, 24, 0.95)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '6px',
  ...style,
}}
```

- [ ] **Step 2: Update COLORS backgrounds**

Change the strain background colors from 7% opacity to more solid:
```typescript
export const COLORS = {
  strainA: '#E8A3A1',
  strainB: '#AFC3D6',
  sharedPool: '#BFDCCD',
  strainABg: 'rgba(232,163,161,0.10)',
  strainBBg: 'rgba(175,195,214,0.10)',
  sharedBg: 'rgba(191,220,205,0.10)',
  strainABorder: 'rgba(232,163,161,0.20)',
  strainBBorder: 'rgba(175,195,214,0.20)',
  sharedBorder: 'rgba(191,220,205,0.20)',
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/fbasim/CommunityPanels.tsx
git commit -m "feat: CommunityPanels remove glassmorphism, reduce border-radius"
```

---

## Task 5: Update MultiO Page Charts to Paper Style

**Files:**
- Modify: `src/components/tools/MultiOPage.tsx`

- [ ] **Step 1: Add PAPER_THEME import**

```typescript
import { PAPER_THEME, SCI_PASTEL_MUTED } from '../charts/chartTheme';
```

- [ ] **Step 2: Update Volcano Plot**

Find the volcano plot SVG. Change background rect from `fill="#050505"` to `fill={PAPER_THEME.bg}`. Update threshold line colors from `rgba(255,255,255,...)` to `PAPER_THEME.grid`. Update axis labels from white to `PAPER_THEME.tickColor`.

- [ ] **Step 3: Update PCA Biplot**

Same pattern: white background, muted axis labels, thinner scatter point strokes.

- [ ] **Step 4: Update Heatmap**

Change heatmap background. Keep the diverging blue-white-red color scale (it's already scientific). Update labels.

- [ ] **Step 5: Update Embedding Scatter**

White background, muted convex hull fills, thinner strokes.

- [ ] **Step 6: Commit**

```bash
git add src/components/tools/MultiOPage.tsx
git commit -m "feat: MultiO charts paper style — white canvas, scientific palette"
```

---

## Task 6: Update ProEvol Recharts Theme

**Files:**
- Modify: `src/components/tools/proevol/chartTheme.ts` (or wherever Recharts theme is defined)

- [ ] **Step 1: Update Recharts tooltip style**

Replace glassmorphism tooltip with paper tooltip:
```typescript
export const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#FFFEF9',
  border: '1px solid #D0CDC8',
  borderRadius: 4,
  padding: '6px 10px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  color: '#333333',
};
```

- [ ] **Step 2: Update chart container**

```typescript
export const CHART_CONTAINER: React.CSSProperties = {
  borderRadius: 2,
  overflow: 'hidden',
};
```

- [ ] **Step 3: Update Recharts CartesianGrid**

If using Recharts `<CartesianGrid>`, change stroke from `rgba(255,255,255,0.06)` to `#E8E5E0`.

- [ ] **Step 4: Update variant trajectory, Muller plot, diversity curve**

Each Recharts chart: white background, paper tooltip, muted grid, thinner lines.

- [ ] **Step 5: Commit**

```bash
git add src/components/tools/proevol/
git commit -m "feat: ProEvol Recharts paper style — white canvas, paper tooltips"
```

---

## Task 7: Update GECAIR Page

**Files:**
- Modify: `src/components/tools/GECAIRPage.tsx`

- [ ] **Step 1: Add PAPER_THEME import**

- [ ] **Step 2: Update Hill curve chart**

White background, thinner curve lines, paper-style axis labels.

- [ ] **Step 3: Update logic surface heatmap**

White background, keep diverging color scale.

- [ ] **Step 4: Commit**

```bash
git add src/components/tools/GECAIRPage.tsx
git commit -m "feat: GECAIR charts paper style"
```

---

## Task 8: Update Remaining Tools (Batch)

**Files:**
- Modify: `CatalystDesignerPage.tsx`, `GenMIMPage.tsx`, `DynConPage.tsx`, `CETHXPage.tsx`, `CellFreePage.tsx`, `NEXAIPage.tsx`, `ScSpatialPage.tsx`

For each tool page:
- [ ] **Step 1:** Add `PAPER_THEME` import
- [ ] **Step 2:** Update SVG chart backgrounds from `#050505` to `#FAFAF8`
- [ ] **Step 3:** Update axis/grid colors from white-based to gray-based
- [ ] **Step 4:** Remove glassmorphism from surrounding panels
- [ ] **Step 5:** Reduce border-radius from 12-20px to 4-6px
- [ ] **Step 6:** Commit per tool

---

## Task 9: Update UI Panel Glass Pattern

**Files:**
- Modify: `src/theme/index.ts`

- [ ] **Step 1: Reduce GLASS border-radius**

Change `GLASS.borderRadius` from `'12px'` to `'6px'`.

- [ ] **Step 2: Make GLASS more opaque**

Change `GLASS.background` from `'rgba(31,37,44,0.92)'` to `'rgba(17, 19, 24, 0.95)'`.

- [ ] **Step 3: Remove backdrop-filter from GLASS**

Remove `backdropFilter: 'blur(12px)'` from the GLASS object.

- [ ] **Step 4: Reduce shadow values**

```typescript
SHADOW_LOW:    '0 1px 4px rgba(0,0,0,0.15)',
SHADOW_MEDIUM: '0 4px 12px rgba(0,0,0,0.2)',
SHADOW_HIGH:   '0 8px 24px rgba(0,0,0,0.25)',
```

- [ ] **Step 5: Commit**

```bash
git add src/theme/index.ts
git commit -m "feat: de-cartoonify UI — reduce radius, remove glassmorphism, lighter shadows"
```

---

## Task 10: Visual Verification

- [ ] **Step 1:** Run `npm run dev` and visit each tool page
- [ ] **Step 2:** Verify charts have white backgrounds with thin, precise lines
- [ ] **Step 3:** Verify tooltips are paper-style (no glassmorphism)
- [ ] **Step 4:** Verify UI panels have reduced border-radius and no blur
- [ ] **Step 5:** Run `npx tsc --noEmit` — no type errors
- [ ] **Step 6:** Run `npm test` — all tests pass
- [ ] **Step 7:** Final commit with all remaining changes

---

## Execution Order

1. Task 1 (tokens) → Task 2 (SVGChartContainer) — foundation
2. Task 3 (FluxMap) + Task 4 (CommunityPanels) — FBASim
3. Task 5 (MultiO) — most chart types
4. Task 6 (ProEvol) — Recharts integration
5. Task 7 (GECAIR) — Hill curves
6. Task 8 (remaining tools) — batch
7. Task 9 (UI panels) — global de-cartoonify
8. Task 10 (verification) — final check
