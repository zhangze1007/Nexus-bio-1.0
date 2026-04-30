# Showcase Selection

## Selected Candidate

Step 16 uses an artemisinin educational trace as the narrow trust-gated showcase.

This is a software trust-runtime demonstration. It is not a claim that Nexus-Bio improves artemisinin biosynthesis, predicts production outcomes, or validates lab outcomes.

## Why This Candidate

The repo already contains artemisinin pathway context and prior trust-gating documentation. That makes the story easy to explain without inventing a new biological benchmark.

The trace is low risk because it focuses on two runtime behaviors:

1. A partial, provenance-backed output can move forward on an allowed claim surface.
2. A demo CETHX thermodynamics output is blocked from becoming a protocol-like claim.

## Alternatives Considered

Beta-carotene was not selected because the repo does not currently have a direct beta-carotene pathway candidate.

Vanillin and lactate were not selected because existing support is lighter and would require inventing more story context.

Community FBA and MultiO remain useful blocked-case examples, but CETHX has the clearest existing thermodynamics boundary and block code for a short showcase.

## Included Tools

- `pathd` as partial pathway context.
- `fbasim` as a partial, provenance-backed recommendation surface example.
- `cethx` as a demo thermodynamics output blocked from protocol use.

## Excluded Tools

- Community FBA is excluded from the main path to avoid implying true joint community FBA.
- MultiO is excluded to avoid implying Bayesian, MOFA, VAE, or reference-model inference.
- CellFree is excluded to avoid implying sourced or calibrated TX-TL parameters.
- DBTL loop-back is excluded to keep the showcase narrow.

## Safe Propagation Path

The safe path is represented in `examples/showcase/safe-pathway.json`.

It shows partial `pathd` and `fbasim` outputs with assumptions, local demo evidence IDs, provenance IDs, and expected `ok` gate decisions on allowed claim surfaces.

## Blocked Case

The blocked case is represented in `examples/showcase/blocked-cethx-claim.json`.

It shows a demo `cethx` output requesting the `protocol` surface. The expected decision is `blocked` with `DEMO_OUTPUT_PROTOCOL_BLOCKED`.

## Three-Minute Reviewer Takeaway

A reviewer should understand that Nexus-Bio can move a traceable partial output forward while preventing a demo output from silently becoming a stronger scientific claim.

## Non-Claims

- No wet-lab validation is claimed.
- No real pathway optimization is claimed.
- No real artemisinin improvement is claimed.
- No claim is made that demo thermodynamics is condition-aware or research-grade.
- No claim is made that a blocked output is biologically false.
- The only claim is that the runtime blocks insufficiently supported propagation to stronger surfaces.
