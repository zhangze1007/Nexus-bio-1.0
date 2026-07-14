# Phase 2–3 Fix Workflow (per finding)

For each suspect in NEXUS_BIO_INTEGRITY_AUDIT_V2.md, in severity order:

1. **Confirm (Phase 2)** — write a code-level test that a fake fix cannot pass:
   - decoy → change an input, assert the output changes;
   - reproducibility → run twice, assert equal after seeding / differs by seed;
   - fabrication → assert the returned value is input-independent / noise.
   Run it; if it does not demonstrate the defect, mark the row `false-positive` and move on.
2. **Fix (Phase 3), failing-test-first**:
   - reproducibility → thread `SeededRNG` (src/utils/seededRng);
   - decoy → implement the real computation;
   - fabrication → Path B (make it real) if tractable from available code/data, else
     Path A (strip false citation, relabel UI/provenance honestly, set validity tier to
     demo/partial). Never chase physical accuracy — defer that class.
3. **Verify** — the confirm-test now passes; `npx tsc --noEmit` clean; full `npx jest` green.
4. **Record** — flip the row to `fixed`; keep the confirm-test as the standing regression guard.

Respect DO-NOT-TOUCH (Knuth Poisson, id generators, legit seeded/diversity RNG) and
FORBIDDEN files (audit-only).
