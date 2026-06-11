# Wave 3: Thermodynamics + Kinetics + Trust Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade thermodynamics to real group contribution calculations, kinetics to multi-inhibition with adaptive ODE, and activate trust engine enforcement.

**Tech Stack:** TypeScript, existing eQuilibrator API, Levenberg-Marquardt optimization

---

## Sub-Project A: Thermodynamics (Tasks 1-5)

### Task 1: Create thermodynamics engine core

**Files:** Create `src/services/thermoEngine.ts`

- [ ] Implement `calcGroupContribution(smiles)` — estimate ΔG°f from molecular structure using Mavrovouniotis group contribution method
- [ ] Implement `calcTransformedGibbs(dG0, pH, ionicStrength, temp)` — Alberty transformed Gibbs energy with Debye-Hückel correction
- [ ] Implement `calcPathwayDeltaG(reactions)` — sum ΔG across pathway steps
- [ ] Write tests in `__tests__/thermoEngine.test.ts`
- [ ] Commit

### Task 2: Integrate eQuilibrator API

**Files:** Modify `src/services/thermoEngine.ts`

- [ ] Add `fetchEquilibratorDeltaG(compoundName)` — call eQuilibrator API for unknown metabolites
- [ ] Add fallback logic: local calculation → eQuilibrator API → error
- [ ] Write tests
- [ ] Commit

### Task 3: Update thermodynamics.ts

**Files:** Modify `src/utils/thermodynamics.ts`

- [ ] Replace hardcoded reference values with `calcTransformedGibbs` calls
- [ ] Keep `calcDeltaG` and `calcKeq` (they're correct)
- [ ] Add `calcMassBalance` using real kinetics (not demo)
- [ ] Write tests
- [ ] Commit

### Task 4: Update ThermodynamicsPanel UI

**Files:** Modify `src/components/ThermodynamicsPanel.tsx`

- [ ] Add pH and ionic strength sliders
- [ ] Show transformed Gibbs energy alongside standard ΔG
- [ ] Add pathway ΔG waterfall chart
- [ ] Commit

### Task 5: Update CETHXPage

**Files:** Modify `src/components/tools/CETHXPage.tsx`

- [ ] Replace mock data with real thermodynamic calculations
- [ ] Add feasibility dashboard
- [ ] Commit

---

## Sub-Project B: Kinetics (Tasks 6-10)

### Task 6: Create kinetics engine core

**Files:** Create `src/services/kineticsEngine.ts`

- [ ] Implement inhibition models: competitive, uncompetitive, mixed, substrate inhibition
- [ ] Implement Hill equation: `v = Vmax * S^n / (K50^n + S^n)`
- [ ] Write tests in `__tests__/kineticsEngine.test.ts`
- [ ] Commit

### Task 7: Implement adaptive ODE solver

**Files:** Modify `src/services/kineticsEngine.ts`

- [ ] Implement Dormand-Prince RK4(5) with adaptive step size
- [ ] Support multi-compartment models
- [ ] Write tests
- [ ] Commit

### Task 8: Implement parameter estimation

**Files:** Modify `src/services/kineticsEngine.ts`

- [ ] Implement Levenberg-Marquardt optimization
- [ ] Support fitting to experimental Km, Vmax, Ki data
- [ ] Write tests
- [ ] Commit

### Task 9: Update kinetics.ts

**Files:** Modify `src/utils/kinetics.ts`

- [ ] Replace `mmVelocity` with multi-inhibition model
- [ ] Replace `runRK4` with adaptive solver
- [ ] Keep backward compatibility
- [ ] Write tests
- [ ] Commit

### Task 10: Update KineticPanel UI

**Files:** Modify `src/components/KineticPanel.tsx`

- [ ] Add inhibition type selector
- [ ] Add parameter estimation interface
- [ ] Show sensitivity analysis
- [ ] Commit

---

## Sub-Project C: Trust Engine (Tasks 11-14)

### Task 11: Activate enforce mode

**Files:** Modify `src/store/slices/toolRunSlice.ts`

- [ ] Change `evaluateWorkbenchPayloadAdmission` mode from `observe` to `enforce`
- [ ] When gate decision is `blocked`, `shouldWritePayload` returns `false`
- [ ] Write tests
- [ ] Commit

### Task 12: Add trust status indicator

**Files:** Create `src/components/workbench/WorkbenchTrustIndicator.tsx`

- [ ] Show trust status (ok/gated/blocked) for current tool
- [ ] Show missing items (provenance, evidence, human gate)
- [ ] Integrate into tool pages
- [ ] Commit

### Task 13: Add export interception

**Files:** Modify `app/api/workbench/route.ts`

- [ ] Check provenance before export
- [ ] Tag unverified data
- [ ] Write tests
- [ ] Commit

### Task 14: Final integration check

- [ ] Run full test suite
- [ ] Run type check
- [ ] Commit

---

## Execution Order

Wave 3 sub-projects run in parallel:
- Tasks 1-5 (Thermodynamics)
- Tasks 6-10 (Kinetics)
- Tasks 11-14 (Trust)

Within each sub-project, tasks are sequential.
