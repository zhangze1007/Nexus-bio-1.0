# Decision: Second Trust-Runtime Implementation

## Purpose

Step 19 adds a minimal implementation of the Nexus-Bio trust runtime outside the Next.js / TypeScript application. The goal is protocol conformance: benchmark cases should be loadable, validated, evaluated, and compared by an independent local implementation without changing product runtime behavior.

## Route Table

| Route | What it means | Strength | Cost | Risk | When to choose |
|---|---|---|---|---|---|
| A. Python stdlib reference | Implement the object model, policy evaluator, benchmark loader, and consistency report with Python standard library only. | Small, portable, readable, no dependency drift. | Manual policy snapshot and modest duplicated protocol types. | Snapshot can drift from TypeScript if not checked. | Best when benchmark inputs are JSON/CSV and Python 3 is available. |
| B. Python + Pydantic | Same reference implementation, but with Pydantic validation models. | Strong runtime validation and clearer schemas. | Adds dependency management. | Dependency bloat for a small protocol conformance task. | Choose when repo already uses Python packaging and Pydantic. |
| C. Rust/WASM | Implement the runtime in Rust and optionally expose WASM. | Strong portability and future embedding path. | Toolchain and compile/test overhead. | Larger implementation surface than Step 19 needs. | Choose when Rust tooling is already established. |
| D. Single-file evaluator | Put all models, policy, loading, and report generation in one Python file. | Fastest to inspect. | Less maintainable as protocol coverage grows. | Harder to test cleanly. | Choose only if repo state makes a package structure unsafe. |

## Selected Route

Route A, Python stdlib reference implementation, is selected.

Python 3 is available in the development environment, benchmark inputs are JSON/CSV, and the task does not require external dependencies. The implementation lives under `reference_impl_py/`, uses `dataclasses`, `enum`, `json`, `csv`, `pathlib`, and `unittest`, and keeps the policy snapshot explicit.

## In Scope

- Core protocol objects: validity tier, claim surface, gate status, gate decision, and claim-surface policy.
- Minimal evidence and provenance dataclasses for protocol completeness.
- Benchmark corpus and expected-label validators.
- Claim-surface policy evaluation using the Step 5/7A semantics.
- Consistency report generation against expected labels and TypeScript runtime-gating results.

## Out Of Scope

- Scientific tools or algorithms.
- FBA, CETHX, MultiO, CellFree, protein design, or biology model rewrites.
- Workbench UI or homepage UI.
- External reviewer validation or Step 20 pilot work.
- Policy DSL or Step 21 work.
- Open standard governance or Step 22 work.

## Non-Claims

- This is not independent third-party validation.
- This is not external adoption.
- This is not scientific validation.
- This is not wet-lab validation.
- This is not evidence that the scientific algorithms are correct.
