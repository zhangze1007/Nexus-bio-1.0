# Frontier Engines Upgrade — Design Spec

**Date:** 2026-06-20
**Scope:** 6 server-side engine algorithm upgrades (zero simplification)
**Standard:** PhD-level synthetic biology + computer science, frontier algorithms only

---

## Executive Summary

Upgrade 6 existing skeleton engines to production-quality implementations with zero simplification markers. All algorithms must be scientifically accurate, reference-backed, and match state-of-the-art implementations in COBRApy, RAVEN, Cameo, and related tools.

## Execution Order (dependency-based)

```
批次1: gemReconstructionEngine  ← foundation, used by others
批次2: mfa13CEngine             ← depends on metabolic model
批次3: regulatoryDesignEngine   ← independent, circuit foundation
批次4: biosensorDesignEngine    ← depends on regulatory
批次5: consortiumDesignEngine   ← depends on FBA/GEM
批次6: bioprocessOptimization   ← depends on all above
```

---

## Batch 1: gemReconstructionEngine

**Current:** 232 lines, 55% complete, 2 simplified markers
**Target:** ~800 lines, 100% complete, zero simplifications

### Architecture

| Module | Algorithm | Reference |
|--------|-----------|-----------|
| EC→Reaction | KEGG REST API + BRENDA kinetics | Kanehisa 2000 |
| GPR Rules | Boolean + probability + regulatory | Thiele 2010 |
| Biomass | Multi-template (E.coli/yeast/human) | iJO1366, Yeast8, Human1 |
| Gap-filling | Thermodynamic-constrained FBA | Agren 2013 (RAVEN) |
| Essentiality | Single/double knockout FBA + MCS | Burgard 2001 |

### Data Flow

```
Gene annotations (EC/GeneID/UniProt)
  → KEGG REST API → reaction list
  → BRENDA kinetics query
  → Stoichiometric matrix S (m×n)
  → GPR boolean parsing → gene-reaction mapping
  → Probability GPR → partial knockout prediction
  → Biomass template matching → biomass reaction
  → Gap-filling (ΔG + FBA) → gap-filling reactions
  → Thermodynamic constraints (TFA) → ΔG bounds
  → Essentiality analysis → essential gene set
  → Output: GEM model + stats + essential genes
```

### Key Algorithms

**Thermodynamic Gap-filling:**
```
min |added_reactions|
s.t. S·v = 0
     v_biomass ≥ 0.01
     ΔG_r·v_r ≤ 0  ∀ reversible reactions
     lb ≤ v ≤ ub
```

**Probability GPR:**
```
P(knockout_effect) = 1 - ∏(1 - p_i)  for OR (isozymes)
P(knockout_effect) = ∏(p_i)           for AND (complexes)
```

**Double Knockout Epistasis:**
```
ε_ij = f(Δi,Δj) - f(Δi) - f(Δj) + f(∅)
```

### Upgrades from Current

1. Remove `// Simplified biomass` — implement full composition (amino acids, nucleotides, lipids, cofactors)
2. Add KEGG REST API integration for dynamic reaction lookup
3. Add GPR boolean expression parser (AND/OR/NOT)
4. Add thermodynamic gap-filling solver
5. Add single/double knockout FBA for essentiality

---

## Batch 2: mfa13CEngine

**Current:** 390 lines, 60% complete, 3 simplified markers
**Target:** ~700 lines, 100% complete, zero simplifications

### Architecture

| Module | Algorithm | Reference |
|--------|-----------|-----------|
| Atom Mapping | Full carbon atom tracking | Antoniewicz 2007 |
| EMU Network | Recursive decomposition + sparse solve | Antoniewicz 2007 |
| Isotope Balance | Steady-state isotopomer matrix | Zamboni 2009 |
| Flux Estimation | Levenberg-Marquardt nonlinear LS | Marquardt 1963 |
| Confidence | Monte Carlo + Bootstrap (1000 samples) | Young 2014 |
| Data Parsing | GC-MS peak area → MID | — |

### Key Algorithms

**EMU Decomposition:**
```
For each metabolite with n carbon atoms:
  Generate EMU sets: {1}, {2}, ..., {n}, {1,2}, {2,3}, ...
  For each reaction:
    Map input EMU → output EMU via atom mapping
    Build EMU network adjacency
```

**Steady-State Isotopomer Matrix:**
```
A·x = b
A = I - N·D    (N = network matrix, D = diagonal flux matrix)
b = labeling substrate vector
Solve via sparse LU decomposition
```

**Levenberg-Marquardt:**
```
min χ² = Σ(MID_exp - MID_sim(v))² / σ²
J = ∂MID_sim/∂v  (Jacobian)
v_{k+1} = v_k + (JᵀJ + λI)⁻¹·Jᵀ·(MID_exp - MID_sim)
Adaptive λ: decrease on improvement, increase on degradation
```

### Upgrades from Current

1. Remove `// Simplified: average the substrate MIDs` — implement full EMU decomposition
2. Replace grid search with Levenberg-Marquardt optimizer
3. Add Monte Carlo confidence interval (1000 samples)
4. Add Bootstrap validation
5. Add GC-MS peak area parsing

---

## Batch 3: regulatoryDesignEngine

**Current:** 265 lines, 65% complete, 4 simplified markers
**Target:** ~600 lines, 100% complete, zero simplifications

### Architecture

| Module | Algorithm | Reference |
|--------|-----------|-----------|
| Promoter Scoring | PWM + UP element + spacer penalty | Brewster 2012 |
| RBS Calculator | Salis 2009 full 5-term thermodynamic model | Salis 2009 |
| Terminator | NN thermodynamic stability | SantaLucia 1998 |
| Codon Optimization | tAI + CAI | dos Reis 2004 |
| Inducible Promoter | Hill function + leak expression | — |

### Key Algorithms

**Salis RBS Full Model (5 terms):**
```
ΔG_total = ΔG_mRNA + ΔG_spacing + ΔG_standby + ΔG_start + ΔG_antiSD

ΔG_mRNA: NN folding energy (SantaLucia 1998 DNA, Freier 1983 RNA)
ΔG_spacing: SD-AUG spacing penalty (optimal 5 bp, 0.5 kcal/mol per bp deviation)
ΔG_standby: standby site energy (min ΔG_bind for sites -30 to -1)
ΔG_start: AUG + anti-SD (3'-AUUCCUC-5') binding energy
ΔG_antiSD: anti-SD sequence match
```

**Terminator NN Thermodynamics:**
```
ΔG_stem = Σ ΔG_stack(i, i+1)
ΔG_loop = ΔG_hairpin(loop_length)
ΔG_total = ΔG_stem + ΔG_loop + ΔG_ttract
efficiency = 1 / (1 + exp(ΔG_total / RT))
```

**tAI Codon Optimization:**
```
tAI = ∏ w_i^(1/L)
w_i = Σ s_ij · n_ij
s_ij = 1 - mismatch_penalty (wobble rules)
n_ij = tRNA gene copy number
```

### Upgrades from Current

1. Remove `const spacerOK = true; // simplified` — implement real spacer length check
2. Remove `// Simplified nearest-neighbor` — implement full NN parameters
3. Remove `return augPos + 5; // simplified` — implement real spacing computation
4. Add ΔG_standby term
5. Add ΔG_start term
6. Add ΔG_antiSD term
7. Add tAI codon optimization
8. Add inducible promoter dynamics

---

## Batch 4: biosensorDesignEngine

**Current:** 141 lines, 50% complete, 2 simplified markers
**Target:** ~500 lines, 100% complete, zero simplifications

### Architecture

| Module | Algorithm | Reference |
|--------|-----------|-----------|
| TF-Ligand Binding | FEP approximation + docking score | — |
| Response Curve | Extended Hill + leak + saturation | Rogers 2015 |
| Dynamic Range | Log sensitivity + SNR optimization | d'Oelsnitz 2023 |
| Promoter Library | Random mutagenesis scan + PWM sampling | — |
| Specificity | Cross-talk network + orthogonality score | — |
| Signal Amplification | Cascade circuit + positive feedback | — |

### Key Algorithms

**Extended Hill Equation:**
```
Response = α + (β - α) · L^n / (Kd^n + L^n) + γ·L
α = basal leak expression
β = max induced expression
γ = linear background term
```

**Binding Affinity:**
```
ΔG_bind = ΔG_vdW + ΔG_elec + ΔG_solv + ΔG_entropy
```

**Orthogonality Score:**
```
Orthogonality = 1 - max(cross_talk[i][j]) / signal[i]
```

---

## Batch 5: consortiumDesignEngine

**Current:** 131 lines, 40% complete, 4 simplified markers
**Target:** ~600 lines, 100% complete, zero simplifications

### Architecture

| Module | Algorithm | Reference |
|--------|-----------|-----------|
| Community FBA | SteadyCom + dynamic FBA | Zomorrodi 2016 |
| Cross-feeding | Full metabolite exchange modeling | — |
| Quorum Sensing | LuxI/LuxR dynamics ODE | — |
| Spatial Structure | Diffusion-reaction on 2D grid | — |
| Stability | Jacobian eigenvalue analysis | — |
| Multi-objective | NSGA-II Pareto front | Deb 2002 |

### Key Algorithms

**SteadyCom:**
```
max Σ w_i · μ_i
s.t. S_i · v_i = 0         ∀ species i
     v_biomass_i ≥ 0.001    ∀ species i
     Σ v_exchange_j = 0      ∀ metabolite j
     μ_i = μ_j               (community growth balance)
```

**Quorum Sensing ODE:**
```
d[AHL_i]/dt = k_prod·[cell_i] - k_degrad·[AHL_i] - k_diff·([AHL_i] - [AHL_env])
d[TF_active]/dt = k_bind·[AHL]^n/(K^n+[AHL]^n) - k_unbind·[TF_active]
```

**Jacobian Stability:**
```
J = ∂f/∂x |_{x*}
λ_i = eigenvalues(J)
stable iff Re(λ_i) < 0 ∀i
```

---

## Batch 6: bioprocessOptimizationEngine

**Current:** 180 lines, 45% complete, 5 simplified markers
**Target:** ~700 lines, 100% complete, zero simplifications

### Architecture

| Module | Algorithm | Reference |
|--------|-----------|-----------|
| Kinetics | Structured metabolic model (not Monod) | — |
| O2 Transfer | Full kLa correlation + agitation power | Garcia-Ochoa 2009 |
| Fed-batch | Pontryagin maximum principle | — |
| Scale-up | Mixing time + mass transfer similarity | — |
| Multi-objective | Yield × rate × titer Pareto | — |
| Process Control | MPC + EKF (digitalTwinEngine integration) | — |

### Key Algorithms

**Structured Kinetics:**
```
dX/dt = μ(S, O₂, P)·X - k_death·X
μ = μ_max·S/(Ks+S)·O₂/(Ko+O₂)·(1-P/Kp)^n  (product inhibition)
q_S = μ/Yxs + m_S  (maintenance)
q_P = α·μ + β      (Luedeking-Piret structured)
```

**kLa Full Correlation:**
```
kLa = a·(P/V)^b·v_s^c·μ_app^d
P = Np·ρ·N³·D_imp^5  (impeller power)
v_s = Q_gas / A  (superficial gas velocity)
```

**Pontryagin Fed-batch:**
```
H = λ_X·dX/dt + λ_S·dS/dt + λ_P·dP/dt + λ_O·dO/dt
∂H/∂F = 0  → optimal feed rate F*
Costate: dλ/dt = -∂H/∂x
Transversality: λ(tf) = ∂Φ/∂x |_{tf}
```

---

## Verification Strategy

For each engine:
1. **Unit tests** — every exported function with known inputs/outputs
2. **Literature benchmarks** — compare results to published data
3. **Edge cases** — empty inputs, extreme values, boundary conditions
4. **Integration tests** — verify pipeline adapter works end-to-end
5. **Honesty checks** — verify no hardcoded/mock responses (existing pattern in codebase)

## Success Criteria

- Zero `// simplified` markers in any engine
- All algorithms match published references
- All unit tests pass
- TypeScript compilation: zero errors
- Full test suite: 2393+ tests passing
