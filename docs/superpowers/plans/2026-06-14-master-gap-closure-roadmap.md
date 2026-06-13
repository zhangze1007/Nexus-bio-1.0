# Master Gap Closure Roadmap

> **For agentic workers:** This is the master roadmap. Each direction has its own detailed sub-plan. Execute sub-plans in order of priority.

**Goal:** Close all CRITICAL and IMPORTANT scientific capability gaps identified in the 2026-06-13 deep gap analysis, transforming Nexus-Bio from a demo platform to a research-grade synthetic biology workbench.

**Architecture:** Each direction adds real algorithms to existing tool engines. All algorithms are TypeScript implementations. Tests verify mathematical correctness against published benchmarks.

**Execution Order:**
1. 🔴 Direction G: MILP Infrastructure + FSEOF + OptKnock (FBASim) — foundation for all strain design
2. 🔴 Direction H: Retrosynthesis + TFA (PATHD + CETHX) — pathway discovery
3. 🔴 Direction I: Molecular Docking + ddG (CATDES + PROEvol) — enzyme engineering
4. 🔴 Direction J: Gillespie SSA (GECAIR) — stochastic gene circuits
5. 🟡 Direction K: MOFA+ + Cell-Cell Comm (MULTIO + SCSPATIAL) — omics
6. 🟡 Direction L: Parameter Calibration + MPC (CELLFREE + DYNCON) — control
7. 🟡 Direction M: Bayesian Optimization + Codon Opt (DBTLflow + gaps) — workflow

**Total:** 7 directions, ~65 tasks

---

## Sub-Plans

| Direction | Plan File | Tools | Priority | Est. Tasks |
|-----------|-----------|-------|----------|------------|
| G | `2026-06-14-dirG-strain-design.md` | HiGHS, FBASim, GENMIM | 🔴 Critical | ~12 |
| H | `2026-06-14-dirH-pathway-discovery.md` | PATHD, CETHX | 🔴 Critical | ~8 |
| I | `2026-06-14-dirI-enzyme-engineering.md` | CATDES, PROEvol | 🔴 Critical | ~10 |
| J | `2026-06-14-dirJ-stochastic-circuits.md` | GECAIR | 🔴 Critical | ~6 |
| K | `2026-06-14-dirK-omics-singlecell.md` | MULTIO, SCSPATIAL | 🟡 Medium | ~10 |
| L | `2026-06-14-dirL-cellfree-control.md` | CELLFREE, DYNCON | 🟡 Medium | ~8 |
| M | `2026-06-14-dirM-workflow-process.md` | DBTLflow, new tools | 🟡 Medium | ~8 |

## Dependency Graph

```
G (MILP + FSEOF + OptKnock) ──► H (retrosynthesis needs FBA)
                              ──► I (enzyme needs flux predictions)
G + H ──► J (circuits need pathway + strain context)
G + I ──► K (omics needs enzyme + flux data)
H + I ──► L (cell-free needs pathway + enzyme params)
All ──► M (workflow integrates everything)
```

## Critical Blocking Gaps (from deep analysis)

1. **HiGHS solver has no MILP support** — blocks OptKnock, ROOM, RobustKnock
2. **GPR parser not wired into LP solver** — blocks gene-level knockout analysis
3. **SMILES parser is broken** — blocks CETHX group contribution for real molecules
4. **No retrosynthesis engine** — PATHD is a viewer, not a designer
5. **No stochastic simulation** — GECAIR is deterministic only
6. **No Bayesian optimization** — DBTLflow uses heuristic weights
7. **No cell-cell communication** — SCSPATIAL has zero L-R analysis
