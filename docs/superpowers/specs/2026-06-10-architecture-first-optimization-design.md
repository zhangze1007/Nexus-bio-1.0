# Architecture-First Optimization Design

**Date:** 2026-06-10
**Author:** Claude Code (with user approval)
**Status:** Approved

## Problem Statement

The Nexus-Bio platform has completed a comprehensive first-principles audit of all 14 tools and fixed critical algorithm issues. The next phase is to:
1. Implement real algorithms (especially VAE for MultiO/ScSpatial)
2. Enhance UI/UX with Apple product designer perspective
3. Optimize overall architecture for maintainability

## Scope

Hybrid approach: Architecture optimization first, then incremental tool-by-tool enhancement.

## Design Details

### Phase 1: Architecture Optimization (1-2 weeks)

#### 1.1 Unified Algorithm Framework

**Current State:**
- Michaelis-Menten: Unified in `src/utils/michaelisMenten.ts` ✅
- ODE Solvers: Multiple implementations (RK4 in CellFree, DynCon, GECAIR)
- Statistics: Scattered across `proevolAnalysis.ts`, `MOIEngine.ts`, `ScSpatialEngine.ts`
- Machine Learning: No unified framework

**Target State:**

**A. Unified ODE Solver (`src/utils/odeSolver.ts`)**
```typescript
export interface ODESystem {
  derivatives: (t: number, y: number[]) => number[];
  events?: Array<{ condition: (t: number, y: number[]) => boolean; action: string }>;
}

export function solveRK4(system: ODESystem, y0: number[], tEnd: number, dt: number): ODESolution;
export function solveEuler(system: ODESystem, y0: number[], tEnd: number, dt: number): ODESolution;
export function solveAdaptive(system: ODESystem, y0: number[], tEnd: number, tol: number): ODESolution;
```

**B. Unified Statistics Framework (`src/utils/statistics.ts`)**
```typescript
export function shannonEntropy(frequencies: number[]): number;
export function selectionCoefficient(freq1: number, freq2: number): number;
export function confidenceInterval(data: number[], confidence: number): [number, number];
export function mannWhitneyU(group1: number[], group2: number[]): { U: number; p: number };
```

**C. Unified ML Framework (`src/utils/machineLearning.ts`)**
```typescript
export interface VAEConfig {
  inputDim: number;
  latentDim: number;
  hiddenLayers: number[];
  beta: number; // KL weight
}

export function trainVAE(data: number[][], config: VAEConfig): VAEModel;
export function pcaProject(data: number[][], nComponents: number): number[][];
export function umapEmbed(data: number[][], nComponents: number): number[][];
```

#### 1.2 Unified UI Component Library

**Current State:**
- `MetricCard` duplicated in `ide/shared/` and `tools/shared/`
- Chart components scattered in `charts/primitives/`
- 3D components in `molecular/` and `tools/`
- Form components inline in each tool page

**Target State:**

**A. Design System (`src/design-system/`)**
```
src/design-system/
├── tokens.ts          # Colors, spacing, typography
├── components/
│   ├── charts/        # Unified chart components
│   ├── 3d/            # Unified 3D components
│   ├── forms/         # Unified form components
│   ├── layout/        # Unified layout components
│   └── feedback/      # Loading, error, success states
├── hooks/             # Shared hooks
└── utils/             # Shared utilities
```

**B. Apple-Inspired Design Principles**
- Clean, minimal interfaces
- Consistent spacing (8px grid)
- Smooth animations (60fps)
- Clear hierarchy (typography scale)
- Accessible (WCAG 2.1 AA)

---

### Phase 2: Incremental Tool Optimization (1-2 weeks per tool)

#### 2.1 Priority Order

| Priority | Tool | Algorithm Enhancement | UI/UX Upgrade |
|----------|------|----------------------|---------------|
| 1 | MultiO | Real VAE with autograd | Latent space visualization |
| 2 | ScSpatial | Fix VAE + PAGA + Louvain | Spatial transcriptomics viewer |
| 3 | GECAIR | More ODE models | Circuit dynamics visualization |
| 4 | ProEvol | Real fitness landscape | Evolution trajectory viewer |
| 5 | CellFree | Parameter validation | TX-TL simulator UI |
| 6 | DynCon | MPC controller | Bioreactor dashboard |
| 7 | CATDES | Real ProteinMPNN | Enzyme design studio |
| 8 | Others | Incremental | Incremental |

#### 2.2 Per-Tool Optimization Flow

**Step 1: Algorithm Enhancement (2-4 hours)**
- Implement real algorithm
- Add unit tests with reference values
- Validate against scientific literature

**Step 2: UI/UX Upgrade (2-4 hours)**
- Apply Apple design principles
- Improve visualizations
- Optimize interactions
- Add responsive design

**Step 3: Testing & Validation (1-2 hours)**
- Run full test suite
- Manual testing
- User feedback

---

### Phase 3: Integration & Testing (1 week)

#### 3.1 Cross-Tool Data Flow
- Verify data flows between tools
- Test workbench synchronization
- Validate provenance tracking

#### 3.2 Performance Benchmarking
- Bundle size analysis
- Runtime performance profiling
- Memory usage optimization

#### 3.3 User Acceptance Testing
- Test with real scientific data
- Gather user feedback
- Iterate on improvements

---

## Implementation Plan

### Week 1-2: Architecture Optimization
- [ ] Create unified ODE solver framework
- [ ] Create unified statistics framework
- [ ] Create unified ML framework
- [ ] Create design system foundation
- [ ] Create unified chart components
- [ ] Create unified 3D components

### Week 3-4: MultiO Enhancement
- [ ] Implement real VAE with autograd
- [ ] Add latent space visualization
- [ ] Optimize ALS factorization
- [ ] Upgrade UI with Apple design

### Week 5-6: ScSpatial Enhancement
- [ ] Fix VAE implementation
- [ ] Fix PAGA connectivity
- [ ] Improve Louvain clustering
- [ ] Upgrade spatial viewer

### Week 7-8: GECAIR Enhancement
- [ ] Add Toggle Switch ODE ✅
- [ ] Add Repressilator ODE ✅
- [ ] Add Logic Cascade ODE
- [ ] Upgrade circuit visualization

### Week 9-10: ProEvol Enhancement
- [ ] Implement real fitness landscape
- [ ] Add epistasis modeling
- [ ] Upgrade evolution viewer

### Week 11-12: Integration & Testing
- [ ] Cross-tool data flow testing
- [ ] Performance benchmarking
- [ ] User acceptance testing
- [ ] Documentation updates

---

## Success Criteria

- [ ] All 14 tools have real algorithm implementations
- [ ] All 14 tools have Apple-inspired UI/UX
- [ ] All 1609+ tests passing
- [ ] Bundle size < 2MB gzipped
- [ ] Lighthouse score > 90
- [ ] User satisfaction > 4.5/5

---

## Risk Mitigation

**Risk 1: Breaking existing functionality**
- Mitigation: Incremental changes, comprehensive testing, feature flags

**Risk 2: Performance regression**
- Mitigation: Performance benchmarks, profiling, optimization

**Risk 3: Scope creep**
- Mitigation: Strict prioritization, MVP approach, user feedback loops

---

**Approved by:** User (2026-06-10)
**Next step:** Invoke writing-plans skill to create implementation plan
