# UI/UX Systematic Refactor — Design Spec

**Date:** 2026-06-11
**Author:** Claude Code (with user approval)
**Status:** Approved (7 design sections all passed)

## Problem Statement

Nexus-Bio's 14 tool pages have a mature but inconsistently applied design system. The UI/UX audit scored 6.2/10 — landing page is Vercel-quality (9/10), but tool pages feel like a functional prototype (5.5/10). Key gaps:

1. 4 pages (DBTLflow, GECAIR, ProEvol, MetabolicEng) don't use ToolShell — legacy layouts
2. No responsive design (fixed px sidebars, hardcoded chart widths)
3. No skeleton loading states (blank during computation)
4. No onboarding / "What is this?" explanations
5. Font sizes as low as 8px (Apple HIG minimum is 11px)
6. Low contrast text in many places
7. No progressive disclosure — all controls visible at once
8. Inconsistent animations

## Decisions Made

| Question | Answer |
|----------|--------|
| Priority direction? | 全部一起做 (all directions) |
| FORBIDDEN pages? | 放开限制，全部升级 (unlock all) |
| MetabolicEngPage? | 保持架构，只升级 UI 细节 (keep XState+WebGL, polish UI only) |
| Styling approach? | Design-system components as vocabulary, CSS vars as grammar, inline only for dynamic values |

## Design Sections

### Section 1: Visual Foundation

**Typography:**
- FS_XS: 10px → 11px (Apple HIG minimum)
- New FS_XXL: 32px (page hero titles)
- Global minimum 11px (SVG axis labels accept 10px)

**Contrast:**
- All `rgba(255,255,255,0.12)` text → minimum `0.25`
- Verify ink/chipText values are readable on dark backgrounds

**Radii (4-tier):**
- R_SM: 8px (chips, badges)
- R_MD: 12px (inputs, cards)
- R_LG: 16px (panels, modals)
- R_XL: 20px (feature cards, heroes)

**Shadows (3-tier):**
- SHADOW_LOW: 0 2px 8px rgba(0,0,0,0.18)
- SHADOW_MEDIUM: 0 8px 24px rgba(0,0,0,0.28)
- SHADOW_HIGH: 0 16px 48px rgba(0,0,0,0.38)

**3D Rendering:**
- LinearToneMapping → ACESFilmicToneMapping (exposure 1.15)
- Add directional light with castShadow

### Section 2: Layout Unification

**Legacy page migrations:**

| Page | Current | Target |
|------|---------|--------|
| DBTLflow | 3-col fixed (260px/flex/260px) + PATHD_THEME | ToolShell + 5 tabs |
| GECAIR | 3-col fixed (240px/flex/240px) + PATHD_THEME | ToolShell + 5 tabs |
| ProEvol | Custom layout + PROEVOL_THEME | ToolShell + 5 tabs |
| MetabolicEng | XState+WebGL (keep architecture) | UI detail polish only |

**DBTLflow tabs:** Cycle | Iterations | Protocol | Delta Pack | Gibson Assembly
**GECAIR tabs:** Circuit | Phase Space | Transfer | Dynamics | Truth Table
**ProEvol tabs:** Landscape | Trajectory | Library | Lineage | Campaign

**Component replacement:** All inline buttons → ActionButton, metrics → MetricCard, tables → DataTable, etc.

### Section 3: Responsive Design

**Breakpoints:**
- mobile: 640px (single column, hidden sidebar)
- tablet: 1024px (two columns, collapsible sidebar)
- desktop: 1280px (three columns, full layout)

**Chart responsiveness:** All fixed-viewBox SVGs → ResponsiveContainer with ResizeObserver

**FloatingControlRail:** Desktop=expanded, Tablet=collapsed overlay, Mobile=bottom sheet

### Section 4: Progressive Disclosure

**Simple/Advanced toggle:** Already exists in ToolShell. Each tool defines which tabs are "advanced".

**Simple view (default):** 1-2 MetricCards, 2-3 key sliders, main viz, primary CTA button
**Advanced view:** All params, all auxiliary charts, export options

**Per-tool Simple/Advanced:**
| Tool | Simple | Advanced |
|------|--------|----------|
| FBASim | FluxMap + glucose + Run | Knockout + Sensitivity + Community |
| CETHX | Waterfall + pathway | ATP Ledger + Feasibility + temp/pH |
| CATDES | 3D Viewer + enzyme | Binding + Sequences + Pareto + Mutagenesis |
| CellFree | Time Course + constructs | Resources + Fitting + IVIV + Reactor |
| DynCon | Trajectory + PID sliders | Hill Curve + Convergence + RBS Bridge |
| MultiO | Embedding + layers | Volcano + Factors + Projection + Efficiency |
| GenMIM | Genome Map + threshold | Targets + Schedule + Efficiency |
| ScSpatial | Hex Grid + upload | UMAP + Clusters + Gene Expression |
| NEXAI | Chat + prompt | Evidence + Session + Automation |
| DBTLflow | Cycle + timeline | Iterations + Protocol + Delta Pack + Gibson |
| GECAIR | Circuit + gate | Phase Space + Transfer + Dynamics + Truth |
| ProEvol | Landscape + campaign | Trajectory + Library + Lineage |

**Loading states:** Skeleton shimmer component for all computation-heavy tools
**Confirmation:** ConfirmDialog for destructive actions ("Clear knockouts", etc.)

### Section 5: Onboarding & Help

**First-visit overlay:** 3-step guide (Welcome → Tools → Axon), persisted via localStorage

**"What is this?" panels:** Each tool gets expandable explanation with glossary + key concepts

**Tools directory:** Add "Recommended" workflow section + stage grouping

### Section 6: Animation & Motion

**Page transitions:** AnimatePresence with y-translate + scale + opacity (Apple easing [0.22, 1, 0.36, 1])

**Chart entry:** Path drawing animation for SVG paths, staggered fade-in for data points

**Micro-interactions:** Button hover lift (-1px) + shadow, card hover lift, MetricCard value spring animation

**Reduced motion:** Respect `prefers-reduced-motion` — all animations collapse to duration: 0

### Section 7: Per-Tool Upgrade Summary

| Tool | Key Changes |
|------|-------------|
| CATDES | FloatingControlRail for non-viewer tabs |
| CellFree | Responsive SVG charts |
| CETHX | Responsive waterfall, skeleton loading |
| DBTLflow | **MAJOR**: 3-col → ToolShell |
| DynCon | Responsive trajectory chart |
| FBASim | Bezier curves in FluxMap, "Run FBA" CTA |
| GECAIR | **MAJOR**: 3-col → ToolShell |
| GenMIM | Responsive genome map |
| MetabolicEng | UI detail polish (fonts, colors) |
| MultiO | Responsive TriPanelEmbedding |
| NEXAI | Font fixes, typing indicator |
| PathD | Inherits MetabolicEng upgrades |
| ProEvol | **MAJOR**: custom → ToolShell |
| ScSpatial | Responsive hex grid |

## New Shared Components

| Component | Purpose |
|-----------|---------|
| `Skeleton.tsx` | Shimmer loading placeholder |
| `ConfirmDialog.tsx` | Destructive action confirmation modal |
| `OnboardingOverlay.tsx` | First-visit 3-step guide |
| `WhatIsThis.tsx` | Expandable "What is this?" explanation |
| `ResponsiveContainer.tsx` | ResizeObserver-based fluid SVG wrapper |

## Success Criteria

- All 14 tools use ToolShell standard layout
- All tools have responsive breakpoints (mobile/tablet/desktop)
- All computation-heavy tools show skeleton loading
- No text below 11px anywhere
- First-visit onboarding overlay works
- All existing tests pass
- Type check passes (`npx tsc --noEmit`)
- Build succeeds (`npm run build`)
