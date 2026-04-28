# Phase 3 Decisions: Public Proof Package

## Decision 5 — Target Audience

Primary audience:
- Overseas university admissions reviewers
- Scholarship reviewers
- Portfolio evaluators

Secondary audience:
- Future university mentors
- Research groups evaluating student readiness

Phase 3 documentation is optimized for clarity, traceability, and scientific honesty for those audiences.

Phase 3 is **not** optimized primarily for:
- GitHub stars
- LinkedIn virality
- Inflated marketing narratives

## Decision 6 — Demonstration Case

Selected demonstration:
- **Artemisinin trust-gated walkthrough**

Rationale:
- The repository already includes an artemisinin showcase pathway and related tool context.
- The walkthrough can anchor claims to existing routes, contracts, assumptions, and runtime behavior already implemented in code.

Scope of what this demo demonstrates:
- Validity tiers (`real` / `partial` / `demo`)
- Tool assumptions and severity (`info` / `warning` / `blocking`)
- `runProvenance` snapshots and trust state requirements
- Runtime gating behavior for downstream tool consumption
- Prevention of weak-evidence propagation from demo outputs into stronger downstream inference

What this demo does **not** demonstrate:
- Real artemisinin optimization in wet-lab settings
- Validated biological production outcomes
- End-to-end research-grade performance across all modules
