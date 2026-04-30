# Limitations

This proof package is a local trust-runtime artifact. It shows that benchmark cases, expected labels, reports, examples, and provenance notes are present and replayable. It does not prove biological truth.

## Scientific Limitations

- Community FBA mode is demo-only illustrative. Single-species FBASim remains a partial-validity simplex LP path; the two-species community view is not a joint community LP and must not support formal community claims.
- CETHX is a demo thermodynamics explainer using reference values. It lacks a condition-aware backend, uncertainty estimates, ionic-strength and pMg correction, compound mapping, and backend provenance.
- MultiO is deterministic demo integration. It is not Bayesian, GP, MOFA, VAE, posterior-uncertainty, or reference-model backed.
- CellFree implements a resource-aware TX-TL ODE structure, but parameters are partially sourced or heuristic, calibration is not established, and uncertainty is not quantified.
- Other partial tools may use real computational components with heuristic parameters, curated reference values, or incomplete coupling terms.

## Runtime Limitations

- The benchmark labels are curated local trust-runtime labels.
- The reports are local benchmark outputs, not independent third-party reproduction.
- The Python second implementation is a local reference implementation with a copied policy snapshot. It is not independent third-party validation.
- No wet-lab validation is included.
- No scientific model validation is included.
- No external validation, regulatory approval, or production-grade safety certification is included.
- No completed human reviewer study or statistical significance claim is included.

## Proof Package Limitations

- Replay assumes repo-root dependencies have been installed with `npm install`.
- Replay runs local scripts and includes a local Python second implementation for protocol comparison, not a second scientific runtime.
- The copied reports can be refreshed by `npm run proof:replay`; numbers must come from scripts, not manual edits.
- The SBOL/PROV examples are alignment examples, not full validator-backed SBOL or PROV-DM compliance fixtures.

## Future Steps

- Step 19 adds a local Python second implementation for protocol replay; automatic policy snapshot generation remains future work.
- Step 20 can support an external reviewer or pilot if real reviewers are involved.
- Step 21 can define a policy DSL if the runtime rules need portable representation.
- Step 22 can draft an open standard around the trust-runtime protocol.
- Future independent third-party replay should be labeled separately if it actually occurs.
