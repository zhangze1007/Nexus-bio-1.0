# Nexus-Bio 1.0

![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-FFD43B?style=flat-square&logo=python&logoColor=blue)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-4CAF50?style=flat-square)
![Trust Runtime](https://img.shields.io/badge/Trust_Runtime-v0-9C27B0?style=flat-square)
![Bio Adapters](https://img.shields.io/badge/Bio_Adapters-14-009688?style=flat-square)

**Assumption-Gated Scientific Inference Runtime**

Nexus-Bio is an assumption-gated scientific inference runtime for synthetic biology workflows.

It wraps AI and computational-biology tool outputs with validity tiers, assumptions, evidence, provenance, claim-surface policy, and gate decisions. The goal is to make weak, demo, missing-evidence, or missing-provenance outputs visibly constrained before they become stronger downstream scientific claims.

The project is currently strongest as a trust-runtime, verification, and workflow-governance layer. The scientific tools are adapters and testbeds inside that runtime, not claims that every model is production-ready biology.

Live demo: [nexus-bio-1-0.vercel.app](https://nexus-bio-1-0.vercel.app)

---

## What Nexus-Bio Is

- A trust runtime for scientific AI workflows, centered on assumptions, evidence, provenance, claim surfaces, and gate decisions.
- A synthetic biology workbench with scientific adapters for pathway analysis, FBA, thermodynamics, TX-TL, DBTL feedback, omics, and related workflows.
- A proof and replay oriented repository with benchmark cases, expected labels, public baseline comparison, proof package checks, and a Python reference implementation.
- An assumption-aware and provenance-aware environment for reviewing when outputs are `real`, `partial`, or `demo`, and what downstream surfaces remain allowed.

## What Nexus-Bio Is Not

- Not a wet-lab validated biofoundry.
- Not an autonomous lab.
- Not a production-grade scientific platform.
- Not a replacement for domain expert review, biosafety review, regulatory review, or experimental validation.
- Not claiming true community FBA unless a joint community LP exists.
- Not claiming real thermodynamics unless a condition-aware backend with uncertainty, mapping, and provenance exists.
- Not claiming Bayesian, GP, MOFA, VAE, or posterior-uncertainty MultiO behavior unless a corresponding backend exists.
- Not claiming fully sourced or calibrated CellFree behavior unless parameter evidence, calibration, and uncertainty evidence exist.
- Not claiming full SBOL compliance unless validated separately by appropriate SBOL tooling.

## Why This Matters

Scientific AI can sound confident even when assumptions, evidence, or provenance are weak. In biology, that can push users toward bad downstream decisions: exporting demo outputs, treating heuristic values as recommendations, or turning draft workflow context into protocol-like handoffs.

Nexus-Bio treats trust metadata as runtime data. A payload can remain visible for exploration while a recommendation, export, protocol, or external handoff is blocked, gated, or marked demo-only.

## Core Runtime Concepts

| Concept | Meaning |
| --- | --- |
| `ValidityTier` | `real`, `partial`, or `demo` support for a tool output or assumption. |
| `ClaimSurface` | Where an output is used: `payload`, `export`, `recommendation`, `protocol`, or `external-handoff`. |
| `GateDecision` | Runtime decision: `ok`, `blocked`, `gated`, or `demoOnly`. |
| `ToolAssumption` | A declared condition, limitation, or dependency introduced by a tool. |
| `Evidence` | Source, dataset, simulation, user input, or review context supporting a value or decision. |
| `ProvenanceEntry` | Trace of tool runs, imports, exports, human gates, or reviews and their upstream dependencies. |
| `WorkflowContract` | Rule for what one tool or surface may receive from another. |
| `ExperimentRecordV1` | Structured record for experimental or simulated assay context. |
| `LearnedDeltaPack` | Reviewed DBTL feedback package used before applying learned changes. |
| Policy DSL | Reviewable JSON policy for claim-surface gate decisions. |

Protocol references:

- [Nexus Trust Runtime Protocol v0](spec/nexus-trust-runtime-v0.md)
- [Trust Runtime Thesis](docs/TRUST_RUNTIME_THESIS.md)
- [Policy DSL v1](spec/policy-dsl-v1.md)
- [Scientific Inference Trust Runtime Draft v1](spec/SITR-draft-v1.md)

## Verification And Replay

The commands below exist in `package.json`:

```bash
npm run benchmark:trust:validate
npm run benchmark:trust:evaluate
npm run benchmark:trust:report
npm run benchmark:public
npm run proof:check
npm run proof:replay
npm run reference:py:compare
npm run policy:dsl:validate
npm run lint
```

These commands verify local trust-runtime artifacts. They do not validate biological truth, wet-lab outcomes, or external adoption.

## Proof Package

The proof package is local-dev replayable evidence of trust-runtime behavior, not scientific validation.

- [Proof package README](proof-package/README.md)
- [Proof package manifest](proof-package/manifest.json)
- [Proof package limitations](proof-package/limitations.md)
- [Demo and partial status table](proof-package/demo-status-table.md)
- [Replication guide](proof-package/replication-guide.md)
- [Replay instructions](proof-package/replay.md)

The package collects specs, benchmark assets, copied reports, examples, provenance notes, limitations, and replay checks in one reviewable place.

## Benchmarks And Reports

These reports are local trust-runtime benchmark and consistency artifacts:

- [Trust benchmark corpus](benchmarks/)
- [Trust metrics report](reports/trust-metrics/latest.json)
- [Falsification metrics note](docs/falsification-metrics.md)
- [Public benchmark methods](docs/public-benchmark-methods.md)
- [Public benchmark report](reports/public-benchmark/report.json)
- [Second implementation consistency report](reports/second-implementation-consistency.json)
- [Second implementation notes](docs/second-implementation.md)
- [Python reference implementation](reference_impl_py/)

The public baseline comparison evaluates `no-gating`, `badge-only`, and `runtime-gating` modes over the local trust-runtime corpus. It measures claim-surface governance behavior, not biological accuracy.

## Policy DSL And SITR Draft

- [Policy fixture](policy/trust-policy-v1.json)
- [Policy DSL v1 specification](spec/policy-dsl-v1.md)
- [SITR Draft v1](spec/SITR-draft-v1.md)
- [SITR conformance levels](docs/sitr-conformance-levels.md)
- [SITR conformance checklist](docs/sitr-conformance-checklist.md)
- [External review protocol](docs/external-review-protocol.md)
- [Reviewer pack](docs/reviewer-pack.md)
- [External review templates](reports/external-review/)
- [Turing path whitepaper](docs/turing-path-whitepaper.md)
- [Adoption roadmap](docs/adoption-roadmap.md)
- [Versioning policy](docs/versioning-policy.md)

SITR is a draft proposal for a portable Scientific Inference Trust Runtime. It is not an official standard, not externally ratified, and not a safety certification.

## Scientific Adapter Boundaries

| Area | Current boundary |
| --- | --- |
| Community FBA | Demo or illustrative unless a joint community LP exists. See [proof-package/limitations.md](proof-package/limitations.md). |
| CETHX | Demo or heuristic unless a condition-aware thermodynamics backend exists. See [proof-package/demo-status-table.md](proof-package/demo-status-table.md). |
| MultiO | Deterministic demo integration unless a reference model and uncertainty backend exist. |
| CellFree | Model structure and parameter sourcing are separated; calibration and uncertainty remain incomplete. |
| DBTL loop-back | Typed deltas require review before application through ExperimentRecordV1 and LearnedDeltaPack boundaries. |

## Workbench And Scientific Adapters

The tools below are adapters and testbeds inside the trust runtime. Their validity tiers and allowed claim surfaces vary by tool and surface.

| Adapter | Route | Boundary |
| --- | --- | --- |
| PATHD | `/tools/pathd` | Pathway and enzyme design navigator with trust-gated pathway context. |
| Metabolic Engineering Lab | `/tools/metabolic-eng` | Backward-compatible PATHD-style lab route; not an independent stronger claim. |
| FBASim | `/tools/fbasim` | Partial single-species simplex LP plus illustrative two-species demo mode; single-species FBA plus demo-only two-species comparison. |
| CETHX | `/tools/cethx` | Demo thermodynamics explainer with explicit feasibility boundary. |
| CellFree | `/tools/cellfree` | TX-TL structure with partial or heuristic parameter evidence; heuristic expression estimates only. |
| DBTLflow | `/tools/dbtlflow` | DBTL iteration ledger and typed feedback boundary. |
| MultiO | `/tools/multio` | Demo multi-omics integration (deterministic sensitivity sketches, layer signals, efficiency context) unless a reference model backend is added. |
| SCSPATIAL | `/tools/scspatial` | Partial `.h5ad` sidecar-backed spatial workflow when required fields are present. |
| CATDES | `/tools/catdes` | Catalyst design workbench with partial scoring boundaries. |
| PROEVOL | `/tools/proevol` | Directed evolution campaign planning; not wet-lab campaign evidence. |
| GECAIR | `/tools/gecair` | Gene circuit reasoning with partial topology and parameter assumptions. |
| GENMIM | `/tools/genmim` | Genome minimization planning with simplified viability assumptions. |
| DynCon | `/tools/dyncon` | Dynamic control simulations with parameter and calibration limits. |
| NEXAI | `/tools/nexai` | Literature assistant whose outputs require evidence and human review. |

## Local Development

```bash
git clone https://github.com/zhangze1007/Nexus-bio-1.0
cd Nexus-bio-1.0
npm install
npm run dev
```

The dev server runs at `http://localhost:3000`.

Create `.env.local` when using AI-backed routes:

```bash
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

`app/api/analyze` uses Groq as primary and Gemini as fallback. Do not treat LLM-assisted outputs as validated scientific evidence.

### SCSPATIAL Sidecar

Real `.h5ad` ingest for SCSPATIAL uses a Python sidecar. Install the sidecar dependencies before uploading spatial datasets:

```bash
python3 -m venv .venv-scspatial
.venv-scspatial/bin/pip install -r requirements-scspatial-sidecar.txt
```

If `.venv-scspatial` exists, the SCSPATIAL sidecar will pick it up automatically.

If `python3-venv` is unavailable, install packages into a repo-local target directory instead:

```bash
python3 -m pip install --target .nexus/scspatial-pydeps -r requirements-scspatial-sidecar.txt
```

If `.nexus/scspatial-pydeps` exists, the SCSPATIAL sidecar adds it to `PYTHONPATH` automatically.

### Deployment Notes

The app is deployed on Vercel. API routes use the runtime declared in their route files; Node runtime routes include FBA, workbench persistence, and SCSPATIAL sidecar surfaces.

Environment variables such as `GROQ_API_KEY` and `GEMINI_API_KEY` belong in the deployment environment and should not be committed.

## Repository Map

- `app/`: Next.js routes, layouts, metadata, and API endpoints.
- `src/`: React components, services, stores, server helpers, workers, and shared tool configuration.
- `docs/`: trust-runtime, benchmark, review, roadmap, and adapter-boundary documentation.
- `spec/`: trust-runtime protocol specs, Policy DSL, SITR draft, PROV-DM mapping, and SBOL-aligned mapping.
- `benchmarks/`: trust-runtime benchmark corpus and expected labels.
- `reports/`: local trust metrics, public benchmark outputs, second implementation report, and review templates.
- `proof-package/`: replayable proof bundle for local trust-runtime behavior.
- `reference_impl_py/`: Python stdlib reference implementation for policy and benchmark comparison.
- `examples/`: showcase and example workflow materials.

## Limitations

- No wet-lab validation claim is made.
- No external validation claim is made unless a real external replay or reviewer result is added in the future.
- No production safety certification is included.
- Benchmark labels are curated local trust-runtime labels.
- Proof package results are local-dev artifacts unless independently replayed and reported.
- The Python reference implementation is local and does not prove third-party adoption.
- Domain experts are needed for deeper scientific adapters, real experimental studies, biosafety review, and regulatory interpretation.
- SBOL and PROV mappings are alignment notes unless separate validator-backed compliance evidence is added.

## About / Origin Note

Nexus-Bio was built by Zhang Ze Foo, a pre-university student in Malaysia on a gap year after completing STPM, and then hardened through staged trust-runtime work. The origin story is part of the project context, but the repository should be evaluated by its inspectable artifacts, limitations, tests, and replay paths.

Contact:

- Email: fuchanze@gmail.com
- LinkedIn: [linkedin.com/in/zhangze-foo-3575ba359](https://linkedin.com/in/zhangze-foo-3575ba359)

## Copilot Agent And Firewall

If you use the GitHub Copilot coding agent on this repo and the workflow fails with `HTTP/2 GOAWAY connection terminated` or a firewall-blocked warning, see [docs/firewall.md](docs/firewall.md).

## License

MIT License - open for research and educational use.
