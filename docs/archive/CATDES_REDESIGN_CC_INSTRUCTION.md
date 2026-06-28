# CATDES (Catalyst Designer) — Complete Redesign Instruction

## ⚠️ IMPORTANT RULES
- **Minimal-diff editing**: Preserve all existing file structure. Do NOT rewrite entire files unless absolutely necessary.
- **No API keys in chat**: All secrets go to Vercel Environment Variables only.
- **Groq primary → Gemini fallback**: Never reverse this order.
- **PATHD is the UI/UX benchmark**: Every design decision should match or exceed PATHD's polish level.
- **Read before writing**: Audit the current CATDES codebase FIRST before making any changes.

---

## PHASE 0: AUDIT (Do this FIRST)

Before writing ANY code, examine the following and report back:

1. `src/pages/tools/catdes/` — full directory structure
2. Current 3D rendering setup — does CATDES use any molecular viewer? (3Dmol.js, NGL, Mol*, etc.)
3. Current data flow — where do enzyme/substrate data come from? Hardcoded? API? workbenchStore?
4. PATHD's implementation — examine `src/pages/tools/pathd/` to understand:
   - How AlphaFold 3D viewer is implemented (which library, how it fetches structure)
   - How the method rail glassmorphism tabs work (component name, CSS approach)
   - How the right-side panel (Overview/Structure/Thermodynamics) is structured
5. Check if `3dmol` or `@3dmol/3dmol` is already in `package.json`
6. Check the workbenchStore.ts to understand CATDES data schema
7. Review REVIEW_PROTOCOL.md for any CATDES-specific audit findings

**Output a summary before proceeding to Phase 1.**

---

## PHASE 1: 3D Molecular Visualization Engine

### 1A: Install & Setup 3Dmol.js (if not already present)

```bash
npm install 3dmol
```

### 1B: Create a unified molecular viewer component

Create: `src/components/molecular/CatalystViewer3D.tsx`

This component must support:

- **Protein rendering** (enzyme): Fetch from AlphaFold DB by UniProt ID (e.g., AF-P08836)
  - Render modes: Cartoon, Surface, Stick (matching PATHD's Cartoon/Surface/pLDDT toggle)
  - Color by: pLDDT confidence, residue type, hydrophobicity, or custom
  - Auto-spin toggle (matching PATHD)

- **Small molecule rendering** (substrate/product): Fetch from PubChem by CID or name
  - API: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/SDF`
  - Render as ball-and-stick with element coloring

- **Docking view** (enzyme + substrate together):
  - Show both in same viewport
  - Substrate positioned at active site
  - Hydrogen bonds, hydrophobic contacts visualized as dashed lines
  - Distance labels on key interactions

- **Interactive features**:
  - Click residue → highlight it → emit event with residue data
  - Hover residue → tooltip with residue name, position, type
  - Zoom to active site button
  - Reset view button
  - Screenshot/export button

### 1C: Data sources

```typescript
// Enzyme structure
const fetchEnzymeStructure = async (uniprotId: string) => {
  const url = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
  // Parse PDB and render
};

// Substrate structure  
const fetchSubstrateSDF = async (compoundName: string) => {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(compoundName)}/SDF`;
  // Parse SDF and render as small molecule
};
```

---

## PHASE 2: Real-Time Computation Engine

### Core principle: Every parameter change must trigger real-time recalculation. NO "calculate" buttons. NO static results.

Create: `src/lib/catalystEngine.ts`

### 2A: Binding Affinity Calculator (Kd)

```typescript
/**
 * Kd (dissociation constant) — lower = tighter binding = better
 * 
 * Simplified physics-based estimation:
 * Kd = exp(ΔG_bind / RT)
 * 
 * Where ΔG_bind is estimated from:
 * - Hydrogen bond contributions (~-2 to -7 kJ/mol each)
 * - Hydrophobic contacts (~-3 kJ/mol per buried CH group)
 * - Electrostatic interactions (Coulomb)
 * - Desolvation penalty
 * - Conformational entropy loss
 * 
 * When user mutates a residue:
 * - Recalculate interaction contributions for that position
 * - Update ΔG_bind
 * - Recompute Kd
 */
```

### 2B: Catalytic Efficiency Calculator (KCAT, KM, KCAT/KM)

```typescript
/**
 * Michaelis-Menten kinetics:
 * v = (KCAT * [E] * [S]) / (KM + [S])
 * 
 * KCAT depends on:
 * - Active site geometry (distance, angle of catalytic residues)
 * - Transition state stabilization
 * 
 * KM depends on:
 * - Substrate binding affinity
 * - Rate constants k1, k-1, k2
 * 
 * When user mutates a catalytic residue:
 * - Recalculate geometric fit (distance/angle deviation from optimal)
 * - Apply penalty/bonus to KCAT based on deviation
 * - Recalculate KM from updated binding contributions
 */
```

### 2C: Catalytic Fit Score

```typescript
/**
 * Composite score 0-1 based on:
 * - Distance fit: how close catalytic residues are to optimal distances
 * - Orientation fit: angular alignment with optimal geometry  
 * - vdW packing: van der Waals complementarity
 * - Electrostatic complementarity
 * 
 * Score = weighted_average(distance_fit, orientation_fit, vdw_fit, electrostatic_fit)
 * Weights: [0.35, 0.30, 0.20, 0.15]
 * 
 * Each component: 1.0 = perfect, 0.0 = completely misaligned
 * Apply gaussian decay from optimal value:
 *   fit = exp(-(observed - optimal)² / (2 * σ²))
 */
```

### 2D: Mutation Impact Predictor

```typescript
/**
 * When user selects a residue and chooses a mutation:
 * 
 * 1. Look up BLOSUM62 substitution score for the mutation
 * 2. Estimate ΔΔG (change in folding free energy):
 *    ΔΔG = Σ BLOSUM62(wt, mut) * position_weight
 * 3. Estimate effect on Kd:
 *    Kd_mutant = Kd_wt * exp(ΔΔG_binding / RT)
 * 4. Estimate effect on KCAT:
 *    If catalytic residue: apply geometric penalty
 *    If non-catalytic: minimal effect
 * 5. Return: { deltaKd, deltaKCAT, deltaCatalyticFit, stabilityRisk }
 */
```

### 2E: Flux Cost Integration

```typescript
/**
 * Connect to workbench FBA data if available:
 * - Metabolic cost of producing the substrate
 * - Cofactor requirements (NADH, ATP, CoA)
 * - Pathway flux capacity
 * 
 * Display as: "This catalyst design requires X flux units, 
 *              which is Y% of the pathway maximum"
 */
```

---

## PHASE 3: UI/UX Redesign — Apple Design Philosophy

### Core layout principle: Progressive Disclosure

```
┌─────────────────────────────────────────────────────────────────┐
│  CATDES · Catalyst Designer                    Research │ Console │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Enzyme Bar (top) ──────────────────────────────────────┐   │
│  │ [ADS ▾] Amorphadiene Synthase · EC 4.2.3.24             │   │
│  │ Substrate: FPP → Product: Amorpha-4,11-diene            │   │
│  │ ⚡ Rate-limiting                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ 3D Viewport (60% width) ─┐  ┌─ Inspector Panel (40%) ──┐ │
│  │                            │  │                           │ │
│  │   [3Dmol.js]               │  │  ┌─────────────────────┐ │ │
│  │   Enzyme + Substrate       │  │  │ Selected: Asp189    │ │ │
│  │   Docking View             │  │  │ Role: acid-base     │ │ │
│  │                            │  │  │ Dist: 3.0 Å         │ │ │
│  │   Click residue to         │  │  │ Angle: 108°         │ │ │
│  │   inspect & mutate         │  │  │                     │ │ │
│  │                            │  │  │ [Mutate ▾]          │ │ │
│  │                            │  │  │ D → E  ΔKd: -12%   │ │ │
│  │                            │  │  │ D → N  ΔKd: +45%   │ │ │
│  │   ○ Cartoon ● Surface      │  │  │ D → A  ΔKd: +230%  │ │ │
│  │   ○ Active Site Zoom       │  │  └─────────────────────┘ │ │
│  │   ◉ Auto-spin              │  │                           │ │
│  └────────────────────────────┘  │  ┌─ Quick Stats ────────┐ │ │
│                                   │  │ Kd    3276 µM  ⊘    │ │ │
│                                   │  │ KCAT  0.04 s⁻¹ ⊘    │ │ │
│                                   │  │ KM    0.01 mM  ✓    │ │ │
│                                   │  │ Fit   0.61     ~    │ │ │
│                                   │  │                      │ │ │
│                                   │  │ ⊘ = poor  ~ = ok     │ │ │
│                                   │  │ ✓ = good  ★ = great  │ │ │
│                                   │  └──────────────────────┘ │ │
│                                   └───────────────────────────┘ │
│                                                                 │
│  ┌─ Method Rail (glassmorphism tabs, matches PATHD) ──────────┐│
│  │ ● Binding │ ○ Sequences │ ○ Flux Cost │ ○ Pareto │         ││
│  │ ○ Mutagen │ ○ Balancer  │                                   ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                                                             ││
│  │  [Content of selected analysis view renders here]           ││
│  │  Glassmorphism card with backdrop-blur                      ││
│  │  Each view is a focused, single-purpose analysis            ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ Design Actions ───────────────────────────────────────────┐│
│  │ ↓ Export Design JSON    ↓ Export Sequences CSV    Full Rpt  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3A: Glassmorphism Method Rail

Copy PATHD's method rail implementation exactly, then adapt for CATDES's six views:

1. **Binding** — 3D interaction view: H-bonds, distances, contact surface area
2. **Sequences** — Aligned sequences with conservation coloring, editable positions
3. **Flux Cost** — Pathway integration, metabolic burden visualization  
4. **Mutagen** — Mutation suggestion table with ΔΔG, sorted by predicted improvement
5. **Pareto** — Multi-objective scatter plot (activity vs stability vs expression)
6. **Balancer** — Pathway flux balance, bottleneck identification

Each tab content should:
- Use `backdrop-filter: blur(16px)` + semi-transparent background
- Have consistent padding (24px)
- Use PATHD's typography: 11px Bold uppercase labels, monospace for values
- Border radius: 20px (platform standard)

### 3B: Quick Stats with Visual Feedback

The inspector panel's Quick Stats must give INSTANT quality feedback:

```typescript
// Quality thresholds for visual indicators
const kdQuality = (kd: number) => {
  if (kd < 1) return { icon: '★', color: 'emerald', label: 'Excellent' };
  if (kd < 10) return { icon: '✓', color: 'green', label: 'Good' };
  if (kd < 100) return { icon: '~', color: 'amber', label: 'Moderate' };
  if (kd < 1000) return { icon: '⊘', color: 'orange', label: 'Weak' };
  return { icon: '⊘', color: 'red', label: 'Very weak' };
};

const kcatQuality = (kcat: number) => {
  if (kcat > 100) return { icon: '★', color: 'emerald', label: 'Excellent' };
  if (kcat > 10) return { icon: '✓', color: 'green', label: 'Good' };
  if (kcat > 1) return { icon: '~', color: 'amber', label: 'Moderate' };
  return { icon: '⊘', color: 'red', label: 'Slow' };
};
```

### 3C: Mutation Workflow (Direct Manipulation)

User flow:
1. Click residue on 3D model → residue highlights (glow effect)
2. Inspector panel shows residue details
3. "Mutate" dropdown appears with all 19 possible amino acid substitutions
4. Each option shows predicted ΔKd, ΔKCAT in real-time
5. User selects mutation → 3D model updates:
   - Old residue fades out (opacity transition)
   - New residue fades in
   - Interaction lines (H-bonds, distances) recalculate and re-draw
   - Quick Stats numbers animate to new values (count-up/down animation)
6. User can undo mutation (Ctrl+Z or undo button)
7. Multiple mutations accumulate → "Design Summary" shows total effect

### 3D: Enzyme Selector

Replace the current left sidebar enzyme list with a compact top bar:
- Dropdown showing enzyme name + EC number
- "Rate-limiting" badge if applicable
- Substrate → Product shown inline
- This frees up horizontal space for the 3D viewport

---

## PHASE 4: Interaction Design Details

### 4A: Transitions & Animations
- Residue selection: 200ms ease-out glow
- Panel content switch: 300ms fade + slide
- Number changes: 400ms count animation (use `framer-motion`'s `animate`)
- Method rail tab switch: 250ms with content crossfade
- 3D model mutation: 500ms morph transition

### 4B: Dark Theme Consistency
- All new components must match existing dark theme
- Background: same as PATHD's panel backgrounds
- Text: same color hierarchy as PATHD
- Borders: subtle, 1px, rgba white with low opacity

### 4C: Responsive Behavior
- Desktop: 60/40 split (3D viewport / inspector)
- Tablet: 3D viewport full width, inspector as bottom sheet
- Mobile: Stack vertically, 3D viewport on top

---

## PHASE 5: Integration with Workbench

### 5A: workbenchStore Connection
- CATDES results should write back to workbenchStore
- Mutation designs should be exportable to DBTL flow
- Flux cost view should pull from FBA data if available

### 5B: Stage System
Keep the existing Stage 1-4 system but make transitions cleaner:
- Stage 1: Select target molecule
- Stage 2: Enzyme analysis & catalyst design (this is the main redesigned view)
- Stage 3: Optimization & validation
- Stage 4: Export & DBTL handoff

---

## EXECUTION ORDER

1. **Phase 0**: Audit and report current state
2. **Phase 1**: Get 3Dmol.js working with a single enzyme render (proof of concept)
3. **Phase 3A+3D**: Implement new layout with enzyme selector and method rail
4. **Phase 2**: Wire up computation engine
5. **Phase 3B+3C**: Implement Quick Stats and mutation workflow
6. **Phase 4**: Polish animations and transitions
7. **Phase 5**: Workbench integration

**Test after each phase. Do not proceed to next phase without confirming current phase works.**

---

## REFERENCE FILES TO EXAMINE
- `src/pages/tools/pathd/` — UI/UX benchmark
- `src/components/` — existing shared components
- `src/stores/workbenchStore.ts` — data bus
- `REVIEW_PROTOCOL.md` — audit findings
- `package.json` — current dependencies
