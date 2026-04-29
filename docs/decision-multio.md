# MultiO Model Decision Memo

P1 Step 11 audits the MultiO model surface in Nexus-Bio. This memo is a scientific honesty and implementation decision. It does not add a reference-model backend.

## Current Implementation Status

MultiO logic currently appears in:

- `src/services/MOIEngine.ts`
- `src/services/OmicsIntegrator.ts`
- `src/components/tools/MultiOPage.tsx`
- `src/components/tools/shared/toolAssumptions.ts`
- `src/components/tools/shared/toolValidity.ts`
- `src/components/tools/shared/toolRegistry.ts`
- `src/store/workbenchPayloads.ts`

MultiO does not currently have Bayesian, Gaussian-process, MOFA-like, VAE-like, perturbation-aware, or reference-model-backed inference. The current implementation is deterministic demo integration.

Evidence from code:

- `src/services/MOIEngine.ts` explicitly documents that MOFA+, GPerturb, production VAE, UMAP, Bayesian posterior uncertainty, and causal perturbation modeling are not implemented.
- `extractMOFAFactors()` is retained as a compatibility API name, but the implementation uses ALS-style low-rank reconstruction rather than MOFA-like variational inference.
- `trainMultimodalVAE()` is retained as a compatibility API name, but the implementation is deterministic seeded encoding/decoding without a learned posterior, autograd training loop, or deployment VAE backend.
- `src/services/OmicsIntegrator.ts` uses local normalization, deterministic projection, layer-signal scoring, and a local sensitivity sketch.
- `src/components/tools/MultiOPage.tsx` writes `validity: "demo"` and records provenance assumptions that the output is not MOFA+, not VAE, not UMAP, and not Bayesian posterior uncertainty.
- `src/components/tools/shared/toolValidity.ts` keeps `multio` at `demo`.

The current outputs include factor-style summaries, projected embeddings, tables, layer-signal scores, and sensitivity-style yield sketches. They do not include posterior variance, credible intervals, reference-model backend name/version, Bayesian inference metadata, GP kernel metadata, MOFA-like model evidence, or VAE posterior evidence.

## Scientific Requirement For Advanced MultiO Claims

Advanced multi-omics claims require the corresponding model to exist. Bayesian, GP, MOFA-like, VAE-like, probabilistic latent, perturbation-aware, and reference-model-backed claims require actual model implementation, model metadata, uncertainty semantics, and clear failure modes. Deterministic normalization, local decomposition, projections, and visualization are useful for exploration, but they cannot be described as posterior inference or reference-model evidence.

The current mode does not meet those requirements.

## Route Decision Table

| Route | What it means | Scientific truthfulness | Engineering cost | User value | Risk | When to choose |
|---|---|---|---|---|---|---|
| A. Reference model integration | Integrate a real backend with typed request/response, backend name/version, uncertainty fields when available, and explicit unavailable/error status. | Highest if implemented and tested. | High. Requires dependency, data-shape contracts, model outputs, and failure handling. | High for users who need probabilistic or reference-backed multi-omics inference. | High if fallback outputs are mistaken for real inference. | Choose later only when the backend can be integrated without fake outputs. |
| B. Split deterministic and reference-model modes | Keep the current deterministic mode and add a separate unavailable/future reference-model mode boundary. | Honest if inactive reference mode is clearly unavailable. | Medium. Requires mode plumbing, docs, tests, and UI labeling. | Moderate. Clarifies the future path while keeping current demo useful. | Medium if users believe the future mode is live. | Choose if a reference-model integration path is selected but not ready. |
| C. Deterministic/demo-only boundary | Keep MultiO as deterministic demo integration and remove misleading model claims. | Honest for current code because it matches local deterministic computation. | Low. Mostly docs, metadata, policy rationales, benchmark cases, wording, and tests. | Moderate. Useful for exploratory workflows and trust-runtime blocking. | Low if formal surfaces stay blocked for demo output. | Choose now for Step 11. |

## Final Step 11 Recommendation

Recommend C now.

Keep MultiO as deterministic demo-only multi-omics integration until a real reference model exists. Do not call current MultiO Bayesian, Gaussian-process-based, MOFA-like, VAE-like, perturbation-aware, probabilistic latent, posterior-uncertainty-aware, or reference-model-backed. Demo MultiO output may remain visible as workbench payload context, but it must not become a formal recommendation, protocol, export, or external-handoff model claim.

## Decision Boundary

Implemented now:

- Decision memo for MultiO model honesty.
- Mode boundary metadata in `src/domain/multioModelBoundary.ts`.
- Assumption metadata for deterministic demo mode, missing reference model, missing Bayesian/GP posterior, missing MOFA/VAE semantics, and missing posterior uncertainty.
- Claim-surface policy rationales that preserve demo payload visibility while blocking formal demo model claims.
- Benchmark cases for misleading Bayesian/MOFA/VAE recommendation, missing posterior uncertainty, and unavailable reference-model export.
- Tests that prevent MultiO model overclaiming.

Not implemented now:

- No Bayesian model.
- No Gaussian-process backend.
- No MOFA-like variational factor model.
- No VAE-like learned posterior model.
- No posterior variance or credible uncertainty.
- No reference-model backend.
- No causal perturbation-response model.
- No export, protocol, recommendation, or external-handoff runtime enforcement.
- No UI redesign.

## Non-Claims

- No Bayesian claim unless a Bayesian model exists.
- No GP claim unless a GP backend exists.
- No MOFA or VAE claim unless those models exist.
- No posterior uncertainty claim unless uncertainty is computed.
- No reference-model-backed claim unless a backend is integrated and tested.
- No wet-lab validation claim.
- Deterministic demo MultiO cannot become a protocol or external-handoff claim.
