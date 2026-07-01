# Scientific Ground-Truth Harness (integrity audit T4)

> "Tests passing ≠ science correct." A fabricated function passes type checks and
> any test written in the same breath. The only durable defense is **ground-truth
> comparison** against an external reference. — NEXUS_BIO_INTEGRITY_AUDIT.md §4

This directory tracks ground-truth comparisons between Nexus-Bio engines and
authoritative external references. Each check either matches the external number
or it doesn't — it cannot be satisfied by self-reporting.

## Status matrix

| Check | Engine | External reference | Wired into CI? | Status |
|-------|--------|--------------------|----------------|--------|
| UMAP `find_ab_params` | `src/server/umapEngine.ts` `findAB` | `umap.umap_.find_ab_params(1.0, 0.1)` → a≈1.5769, b≈0.8951 | ✅ `__tests__/groundTruthChecks.test.ts` + `umapFindAB.test.ts` | **PASSING** (JS, no Python) |
| PCA top eigenvector | `bioreactorAnalyticsEngine.ts` `computePCA` | analytic / `numpy.linalg.svd`: perfectly-correlated cols → [1/√2, 1/√2] | ✅ `__tests__/groundTruthChecks.test.ts` | **PASSING** (JS, no Python) |
| FBA growth rate | `src/server/fbaEngine.ts` | COBRApy on **iJO1366**, glucose minimal media → ~0.98 h⁻¹ (Orth et al. 2011; the audit cites ~0.87 under tighter O₂/media constraints — pin the exact media before asserting) | ❌ | **BLOCKED** — needs Python (see below) |
| Thermodynamics ΔG′ | `src/server/tfaEngine.ts` / `cethx` | eQuilibrator 3 API ΔG′° per reaction | ❌ | **BLOCKED** — needs Python + network |
| CRISPR on-target | `crisprEditingEngine` / Doench Rule Set 2 | Doench 2016 Rule Set 2 supplementary data | ❌ | **BLOCKED** — needs dataset |

## Why the Python checks are BLOCKED in this environment

- **No system Python** is available on the build machine (`python`/`python3` absent).
- **COBRApy cannot run in Pyodide** (browser/Node Python-in-WASM): Pyodide v314
  ships Python 3.14, for which `pandas` (a COBRApy dependency) has no wheel. This
  is verified and documented in `__tests__/pyodideCobra.test.ts` — the FBA engine
  already assumes a Python microservice fallback for real COBRApy parity.

These checks are **not fabricated as passing.** They are specified here with
their expected values and provenance so they can be wired the moment a Python
environment (or the FBA microservice) is available.

## How to run the Python checks (when a Python env exists)

```bash
python -m venv .venv && . .venv/bin/activate      # or Windows: .venv\Scripts\activate
pip install cobra equilibrator-api numpy umap-learn

# 1. FBA vs COBRApy on iJO1366
#    - load iJO1366, set the SAME exchange bounds as fbaEngine's iJO1366 subset,
#      optimize biomass, and compare to the /api/fba growth rate.
#    - assert |Δgrowth| < 1e-2 h⁻¹.
#
# 2. UMAP find_ab_params (independent regeneration of the JS reference)
python - <<'PY'
from umap.umap_ import find_ab_params
a, b = find_ab_params(1.0, 0.1)          # spread, min_dist
print(f"a={a:.4f} b={b:.4f}")            # expect a≈1.5769 b≈0.8951
PY
#
# 3. PCA vs numpy.linalg.svd on the same fixed matrix used in the JS test.
# 4. CRISPR on-target vs the Doench 2016 Rule Set 2 supplementary CSV.
```

Wire each into CI as a separate job gated on Python availability; on match,
flip the corresponding row above to ✅ and add the assertion to the JS suite via
a JSON fixture emitted by the engine (so the JS test compares engine output to
the frozen external number).

## Anti-fabrication rules (from the audit)

1. **No self-report** — paste real command/test output, never "✔ fixed".
2. **Ground truth, not internal consistency** — a passing test the same commit
   wrote does not prove correctness; the external comparison is the proof.
3. **A decoy is worse than a stub** — a function that ignores its inputs must be
   made to change output when inputs change (see the `findAB` fix).
