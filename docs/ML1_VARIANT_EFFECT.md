# ML-1 — Variant-Effect Prediction Chain (honest write-up)

**Date:** 2026-07-24 · **Status:** local end-to-end verified. Hosted deploy + full interactive UI are deliberately deferred.

## What this is

An input-variant → predicted-fitness AI chain built on the *already reference-validated* pieces:
ESM-2 delta embedding → Ridge regression (`src/modules/ml/models.ts`, = scikit-learn `fit_intercept=True` to 6 dp),
Spearman = scipy (`src/modules/ml/spearman.ts`). It also computes a **zero-shot** ESM-2 masked-marginal
baseline. Everything below uses **real ESM-2 weights on real ProteinGym data** — no mock/simulated/fabricated numbers.

```
variant (e.g. "E210I")
   │  ESM-2 esm2_t12_35M_UR50D  (mean-pool excl <cls>/<eos>)
   ▼
delta embedding = emb(variant) − emb(WT)          ┌─ supervised: delta · coef + intercept  → predicted_fitness
   │  (480-dim)                                    ├─ zero-shot:  log P(mut) − log P(wt) at masked position → zeroshot_score
   ▼                                               └─ (the two are reported side by side)
benchmarks/models/blat_ecolx_ridge_v1.json  ── loaded by ── scspatial-backend/variant_effect_service.py ── proxied by ── app/api/variant-effect
```

## Components (all new; nothing else touched)

| Piece | File | What it does |
|---|---|---|
| Model artifact | `benchmarks/models/blat_ecolx_ridge_v1.json` | Versioned, committable (~37 KB): `coef(480)`, `intercept`, `wt_seq(286)`, `wt_embedding(480)`, `esm_model_id`, feature convention, training provenance (size=1000, seed=1000000, alpha=1), 1500 hold-out indices. |
| Export + self-check | `scripts/exportRidgeModel.mts` | Reproduces the learning-curve run and exports coef/intercept. |
| Inference backend | `scspatial-backend/variant_effect_service.py` | Real ESM-2; `build`/`eval`/`predict`/`serve` (FastAPI `POST /predict`, `GET /health`). |
| API proxy | `app/api/variant-effect/route.ts` | Proxies to the backend; **honest degradation** when it is not connected. |
| Validity | `src/config/toolValidity.ts` → `varianteffect` (one new `partial` entry) | Surfaces what is / isn't real. |

## Results (real numbers, traceable to seeds)

**(1) Export self-check — artifact reproduces the learning curve exactly.**
Exported model = learning-curve run size=1000 / seed=1000000 / alpha=1. Recomputing the hold-out Spearman from the
exported coef/intercept gives **0.482084**, and those coefficients reproduce the model's own `predict()` to **4.4e-16**
(so the 0.4821 stored in `learning_curve_results.json` is just its 4-dp display). ±1e-6 self-check ✔.

**(2) Delta-consistency — inference matches the training features.**
For real variants, `emb(variant) − wt_embedding` reproduces the training `features.json` deltas to **max |Δ| = 4.99e-07**.
The backend feeds the Ridge model the same feature convention it was trained on.

**(3) Live predictions (real service output, criterion b).** `predicted_fitness` / `zeroshot_score`:

| variant | true DMS | predicted_fitness | zeroshot_score |
|---|---:|---:|---:|
| W227P | −3.577 | −1.532 | −4.580 |
| R159F | −1.186 | −1.589 | −5.257 |
| E210I | +0.349 | −1.058 | −0.389 |

Both models correctly separate the near-neutral E210I from the two deleterious variants; the supervised head's
outputs are regressed toward the mean (expected at Spearman ≈0.48).

**(4) Zero-shot vs supervised (criterion d) — the headline, reported straight.**

| method | Spearman | set |
|---|---:|---|
| Zero-shot ESM-2 masked-marginal | **0.5567** | full assay (n=4996) |
| Zero-shot ESM-2 masked-marginal | **0.5512** | same 1500 hold-out |
| Supervised Ridge on delta embeddings | **0.4821** | same 1500 hold-out |

## Do we actually need the supervised ML? — No, not *with mean-pooling*.

> **Superseded by the per-position follow-up below (2026-07-24).** With the mutation-site
> feature instead of mean-pooling, supervised ML **beats** zero-shot from ~500 samples. The
> paragraph below is true only for the mean-pooled feature; read the Follow-up section for the
> current answer.


On this BLAT assay the **zero-shot ESM-2 baseline (0.551) beats the supervised Ridge head (0.482)** on the identical
hold-out. Mean-pooling the 480-dim embedding over all 286 residues dilutes the single-residue mutation signal, so a
linear head trained on 1000 variants cannot out-predict reading the log-odds straight off the masked position. Honest
conclusion: for a single published assay, **use ESM-2 zero-shot** — it is free (no training), needs no labels, and is
better. Supervised ML would only earn its place with per-position / non-pooled features, larger ESM-2, or multi-assay
transfer — none of which this goal claimed. The supervised pipeline is still correct and reference-validated; it simply
is not the winning model on this benchmark, and we say so.

## Scope & honesty guarantees

- **Protein-specific, within-assay.** The trained model scores held-out substitutions of **one** protein
  (TEM-1 β-lactamase / BLAT_ECOLX) inside **one** published assay (Stiffler 2015, ProteinGym). It is not a
  general variant-effect predictor and makes no claim about novel proteins/folds.
- **No fabrication on degradation.** With no `VARIANT_EFFECT_BACKEND`, the API returns HTTP 503 with
  `backend_connected:false, source:"unavailable"` and **no** `predicted_fitness` — never a mock number
  (tested in `__tests__/api/variant-effect-route.test.ts`).
- **Data stays local.** `features.json` (24.9 MB) is not committed; only the small artifact is.

## Reproduce

```bash
npx tsx scripts/exportRidgeModel.mts                                   # artifact + self-check (0.482084)
python scspatial-backend/variant_effect_service.py build              # add WT seq+embedding, delta-consistency 5e-07
python scspatial-backend/variant_effect_service.py predict --mutation E210I
python scspatial-backend/variant_effect_service.py eval               # zero-shot 0.5567/0.5512 vs supervised 0.4821
python scspatial-backend/variant_effect_service.py serve              # FastAPI; then set VARIANT_EFFECT_BACKEND=http://127.0.0.1:8077
```

## Deferred (not this goal)

Hosted deployment of the backend, and the full interactive front-end (a variant input box wired to `/api/variant-effect`
with the `DataSourceBadge` / validity badge). The API contract and validity entry are in place for that next step.

---

## Follow-up (2026-07-24): per-position features — the sample-efficiency wedge holds

ML-1's headline ("zero-shot wins, supervised adds nothing") was a property of **mean-pooling**, not of
supervised ML. Re-running the *identical* learning-curve harness on a per-position feature overturns it.

**Feature change (`scspatial-backend/extract_perpos_features.py`).** Instead of mean-pooling the delta over
all 286 residues, take the residue-level embedding difference **at the mutated position only**:
`X[i] = last_hidden_state(variant)[pos] − last_hidden_state(WT)[pos]` (same ESM-2 `AutoModel.last_hidden_state`,
480-dim; `pos` = 1-indexed residue = token index since `<cls>` is token 0). This isolates the local
single-mutation signal that mean-pooling was diluting. Output `features_perpos.json` (4996×480, not committed),
same row order as `features.json`, so the fixed seed-0 hold-out selects the same 1500 variants.

**Result (same 1500 hold-out, 10 seeds/size, validated Ridge + Spearman):**

| train size | per-position (mean±std) | mean-pooled (ML-1) | zero-shot |
|---:|---:|---:|---:|
| 50 | 0.342 ± 0.065 | 0.404 | 0.551 |
| 100 | 0.416 ± 0.039 | 0.426 | 0.551 |
| 200 | 0.503 ± 0.025 | 0.443 | 0.551 |
| 500 | **0.585 ± 0.011** | 0.467 | 0.551 |
| 1000 | **0.663 ± 0.011** | 0.476 | 0.551 |

Floor ≈ 0 at every size; 18,500 leak checks passed. **Per-position supervised overtakes zero-shot (0.551)
between train size 200 and 500** (interpolated crossover ≈ 350) and reaches **0.663** at 1000 — comfortably
past zero-shot and still climbing. (At n=50–100 the 480-dim per-position feature is noisier than mean-pooling,
so it trails there; it needs a few hundred labels to shine, then scales far better.)

**Strategic conclusion:** the wedge holds. With the right feature, a few hundred labelled variants beat the
zero-shot PLM, and the gap widens with data. The product story is **per-position supervised** (once past ~350
labels), with **zero-shot as the cold-start** below that.

### Productized (2026-07-24)

The per-position model is now the shipped predictor:

- **Artifact** `benchmarks/models/blat_ecolx_perpos_ridge_v1.json` (28 KB, committable): `coef(480)`, `intercept`,
  `feature:"perpos_delta"`, extraction convention, `esm_model_id`, `wt_seq(286)`, `holdout_indices`. Exported by
  `scripts/exportPerposRidgeModel.mts` reproducing size=1000/seed=1000000/alpha=1. **Self-check: hold-out Spearman
  = 0.675552, reproducing the run to 3.55e-15** (the results JSON stores it as 0.6756; the 0.663 headline is the
  10-seed mean 0.663±0.011, and this committed seed sits at 0.676). seed0 is a pre-committed choice, so no
  hold-out-guided model selection.
- **Backend** `scspatial-backend/variant_effect_service.py`: `predict` now takes the per-position path — with a
  `mutation` it computes the mutation-site delta → per-position Ridge → `predicted_fitness`, and returns
  `zeroshot_score` alongside (cold-start). `GET /health` reports `feature:"perpos_delta"`. A `variant_seq`-only
  request (site unknown) falls back to the mean-pooled model.
- **API + validity** unchanged in contract: same fail-closed 503 when `VARIANT_EFFECT_BACKEND` is unset (never a
  fabricated number); the `varianteffect` tier stays `partial` with the caption updated to the per-position story.

