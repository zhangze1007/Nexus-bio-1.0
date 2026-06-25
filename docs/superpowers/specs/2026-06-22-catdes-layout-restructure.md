# CatDes Layout Restructure — Design Spec

## Goal
Replace ToolShell-based single-column layout with a left-right split layout for the Catalyst Designer page. Left side: 3D protein viewer. Right side: enzyme info sidebar with kinetics, binding, residue analysis, and mutation predictions.

## Constraints
- Don't change any engine logic (CatalystDesignerEngine, kineticsEngine, etc.)
- Don't change the data flow (useMemo computations, API calls)
- Don't remove any existing tabs or their content
- Don't break workbench integration (setToolPayload)

## Layout

```
┌──────────────────────────────────────────────────────┐
│ ← Back   Catalyst Designer              [partial]    │
├──────────────────────────┬───────────────────────────┤
│                          │  Enzyme Header             │
│                          │  Name · EC · Organism      │
│                          ├───────────────────────────┤
│   3D Viewer (55%)        │  Kinetics (SABIO-RK)      │
│   CatalystViewer3D       │  Km · kcat · kcat/Km      │
│                          ├───────────────────────────┤
│   Controls:              │  Binding (empirical)       │
│   - Render mode          │  Kd · Score · contacts     │
│   - Spin toggle          │  ±2 kcal/mol               │
│   - PDB upload           ├───────────────────────────┤
│   - ESMFold predict      │  Selected Residue          │
│                          │  Role · Distance · ΔΔG     │
│                          ├───────────────────────────┤
│                          │  Mutation Selector          │
│                          │  [Mutate to: ▼]             │
├──────────────────────────┴───────────────────────────┤
│  [Overview] [Sequences] [Pathway Balance] [Pareto]    │
│  Tab content area                                     │
├──────────────────────────────────────────────────────┤
│  [Export] [Send to ProEvol →]                         │
└──────────────────────────────────────────────────────┘
```

## Components

### New: `CatDesSidebar.tsx`
Right-side panel containing:
- Enzyme header (name, EC number, organism)
- Kinetics section (Km, kcat, kcat/Km, DataSourceBadge)
- Binding section (Kd, score, contacts, ±2 kcal/mol)
- Selected Residue section (role, distance, ΔΔG)
- Mutation selector dropdown

### Modified: `CatalystDesignerPage.tsx`
- Remove ToolShell wrapper
- Add custom header (back button, title, validity badge)
- CSS Grid: `55% 45%` for viewer/sidebar
- Bottom: tab bar + tab content + footer
- Keep all existing state and computations

## Data Flow (unchanged)
- `activeEnzyme` → sidebar kinetics display
- `binding` → sidebar binding display
- `selectedResidue` + `selectedCatResidue` → sidebar residue display
- `mutationImpact` → sidebar ΔΔG display
- `dockingResult` → sidebar contacts display
- All useMemo computations stay in CatalystDesignerPage.tsx
