# Phase 2 Decisions: Runtime Gating + Provenance Trust Boundary

## Decision 1 — Runtime Gating UI Behavior

Phase 2 uses tier-aware runtime gating as the default trust boundary.

- `demo -> demo`: allowed, but labelled as a demo-only chain.
- `demo -> partial`: blocked.
- `demo -> real`: blocked.
- `partial -> partial`: allowed with caution when warning assumptions are present.
- `partial -> real`: allowed only when no blocking assumptions are present.
- `real -> partial` / `real -> real`: allowed.
- Missing `runProvenance` where runtime provenance is required is treated as untrusted and blocks downstream inference.
- Any output carrying blocking assumptions cannot be used for recommendation, claim generation, export-as-evidence, or downstream inference into partial/real tools.

## Decision 2 — Community FBA

Phase 2 keeps `fbasim-community` as `demo`.

The current implementation runs two independent single-species LP solves and applies post-hoc exchange scaling. It is not a joint community LP and does not define a joint stoichiometric matrix, species-specific biomass variables, shared exchange metabolites, cross-feeding constraints, or a joint objective function.

Phase 2 therefore follows Option B: strengthen provenance, gating, docstrings, and UI disclosure. A true joint community LP is deferred until the model can explicitly define the community optimization problem and its failure modes.

## Decision 3 — MultiO

Phase 2 keeps MultiO as `demo`.

The current implementation is a deterministic local multi-omics demonstration using linear factor decomposition, linear projection, and sensitivity-style perturbation. It is not MOFA+, not a variational autoencoder, not UMAP, not Bayesian posterior uncertainty, and not a causal perturbation model.

Phase 2 follows Option C: document the method honestly and keep the demo tier. GPerturb, `gpytorch`, GPU-backed training, and heavyweight ML services are not introduced.

## Decision 4 — CETHX

Phase 2 keeps CETHX as `demo`.

CETHX remains a placeholder thermodynamics workflow with bundled reference values and simplified transforms. The existing banner stays in place, and Phase 2 adds runtime provenance so downstream gating can treat the output as demo-only.

No eQuilibrator integration is added in Phase 2. A future integration must first verify the supported path, such as local Python package, command-line tool, cache, or API, before changing the implementation or validity tier.
