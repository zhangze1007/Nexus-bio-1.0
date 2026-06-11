# Wave 3: Thermodynamics + Kinetics + Trust Engine

**Date:** 2026-06-11
**Status:** Draft

---

## Sub-Project A: Thermodynamics Engine Upgrade

### Goal
Replace lookup-table thermodynamics with real group contribution calculations and Alberty transformed Gibbs energy.

### Features
1. **Group Contribution Calculation** — Mavrovouniotis method for ΔG°f from SMILES
2. **Alberty Transformed Gibbs Energy** — pH-dependent, ionic strength correction
3. **Pathway ΔG Profile** — waterfall chart with feasibility check
4. **eQuilibrator API Integration** — fallback to eQuilibrator for unknown metabolites

### Files
- `src/services/thermoEngine.ts` — New: group contribution + transformed Gibbs
- `src/utils/thermodynamics.ts` — Rewrite to use thermoEngine
- `src/components/ThermodynamicsPanel.tsx` — UI upgrade
- `src/components/tools/CETHXPage.tsx` — Real computation integration

---

## Sub-Project B: Kinetics Engine Upgrade

### Goal
Upgrade from simple MM + fixed RK4 to research-grade kinetics with multiple inhibition types and stiff solvers.

### Features
1. **Enzyme Inhibition Models** — competitive, uncompetitive, mixed, substrate inhibition, Hill equation
2. **ODE Solver Upgrade** — Dormand-Prince RK4(5) adaptive step size
3. **Parameter Estimation** — Levenberg-Marquardt from experimental data
4. **BRENDA Integration** — fetch known parameters as initial guesses

### Files
- `src/services/kineticsEngine.ts` — New: multi-inhibition + adaptive ODE
- `src/utils/kinetics.ts` — Rewrite to use kineticsEngine
- `src/components/KineticPanel.tsx` — UI upgrade

---

## Sub-Project C: Trust Engine Activation

### Goal
Transition Trust Policy Engine from observe to enforce mode.

### Features
1. **Payload Write Blocking** — gate decision blocks store writes
2. **Export Interception** — provenance check before export
3. **Route Guards** — block unauthorized access
4. **UI Feedback** — trust status indicator

### Files
- `src/store/slices/toolRunSlice.ts` — Change observe → enforce
- `src/components/workbench/WorkbenchTrustIndicator.tsx` — New
- `src/components/tools/shared/TrustGate.tsx` — New
