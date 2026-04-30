# Nobel Path Scientific Question

Status: `not-yet-run`

This document defines a long-term scientific bet for Nexus-Bio. It does not claim a Nobel-level result, a scientific discovery, wet-lab validation, external validation, adoption, or statistical significance.

## Scientific Question

Can assumption-gated DBTL reduce unsafe design branch execution in synthetic biology workflows when evidence quality is uneven?

The working claim is falsifiable: compared with `no-gating` and `badge-only` workflows, `runtime-gating` should reduce invalid or unsafe downstream design branches without creating an unacceptable false block rate.

## Why This Is Biological Design

This is not only a software UX question. Synthetic biology DBTL workflows turn uncertain biological evidence into design choices, experiments, assays, learned parameter updates, and downstream handoffs. A weakly supported thermodynamic assumption, missing provenance record, or demo-tier model output can push a biological design toward an invalid construct, unsafe protocol-like step, or irreproducible iteration.

The biological design question is whether explicit assumptions, evidence quality labels, provenance, and gate decisions improve which biological branches are executed or rejected.

## Candidate Domains

- Pathway design with thermodynamics uncertainty: reduce design branches that treat simplified or demo thermodynamic estimates as protocol-ready evidence.
- Cell-free expression parameter uncertainty: avoid overconfident parameter updates when cell-free expression assumptions or source records are incomplete.
- Multi-omics evidence uncertainty: prevent exploratory projections or incomplete evidence from becoming strong biological recommendations.
- Community FBA overclaim prevention: block branches that treat illustrative community exchange behavior as a real community FBA conclusion.

## Selected Narrow Question

Selected question: in DBTL-style synthetic biology workflows with uneven evidence quality, does `runtime-gating` reduce unsafe downstream design branch execution compared with `no-gating` and `badge-only` modes?

The first study should focus on historical or curated workflow traces where each candidate branch can be labeled as valid, invalid, unsafe, unsupported, or unresolved using predeclared criteria.

## Why This Is Feasible

The repo already contains trust-runtime benchmark cases, public benchmark reports, showcase traces, explicit validity tiers, and typed DBTL feedback surfaces. These artifacts are enough to design the study and define metrics, but they are not enough to claim a real scientific result.

A future study can use public historical datasets, curated synthetic biology case studies, or partner-provided DBTL logs if real permission and provenance exist. Until then, this remains a not-yet-run study design.

## What Would Count As Success

Success would require a real dataset and a predeclared analysis showing that `runtime-gating` reduces invalid branch execution or unsafe direction selection relative to `no-gating` and `badge-only` workflows.

The result would also need bounded false block rates, reproducible decision logs, transparent provenance, and documented cases where the gate prevented a specific unsupported biological design branch.

## What Would Falsify The Claim

The claim would be weakened or falsified if:

- `runtime-gating` does not reduce invalid branch execution compared with baselines.
- `runtime-gating` reduces unsafe branches only by blocking too many valid branches.
- `badge-only` workflows perform equivalently when tested on the same decision traces.
- Decision reproducibility is poor across reruns, reviewers, or implementations.
- The apparent benefit disappears when tested on a real historical dataset rather than curated examples.

## What Is Not Claimed Now

- No Nobel-level result is claimed.
- No completed scientific result is claimed.
- No wet-lab validation is claimed.
- No scientific validation is claimed.
- No external validation is claimed.
- No statistical significance is claimed.
- No public or historical dataset result is claimed.
- No user adoption or reviewer outcome is claimed.
- No full SBOL compliance is claimed.
