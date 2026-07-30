"""
variant_effect_service.py  —  ML-1 inference backend (real ESM-2 + exported Ridge)

Turns a variant into a predicted fitness using the SAME pipeline that was
reference-validated (ESM-2 delta embedding -> Ridge) plus a zero-shot ESM-2
masked-marginal baseline. Follows the scspatial-backend service pattern
(FastAPI, loaded on demand). Real model + real weights only — no mock path.

Subcommands:
  build   : compute WT sequence + WT embedding, add to the Ridge artifact,
            and verify the delta convention matches the training features.json.
  eval    : zero-shot Spearman over the whole BLAT assay (vs real DMS_score).
  predict : one-off prediction for a test variant (prints predicted_fitness + zeroshot).
  serve   : run the FastAPI service (POST /predict, GET /health).

Model: facebook/esm2_t12_35M_UR50D (480-dim). CPU is fine.
"""

import argparse
import json
import os

import numpy as np
import torch
from transformers import AutoModelForMaskedLM, AutoTokenizer

MODEL_ID = "facebook/esm2_t12_35M_UR50D"
_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "benchmarks", "models")
ARTIFACT = os.path.join(_MODELS_DIR, "blat_ecolx_ridge_v1.json")          # mean-pooled (ML-1)
PERPOS_ARTIFACT = os.path.join(_MODELS_DIR, "blat_ecolx_perpos_ridge_v1.json")  # per-position (the product)

_tok = None
_model = None
_WT_RES: dict[str, "np.ndarray"] = {}  # wt_seq -> WT residue hidden states (L, D), cached


def _esm():
    global _tok, _model
    if _model is None:
        _tok = AutoTokenizer.from_pretrained(MODEL_ID)
        _model = AutoModelForMaskedLM.from_pretrained(MODEL_ID, output_hidden_states=True).eval()
    return _tok, _model


def embed(seqs, batch_size=8):
    """Mean-pooled last-hidden-state embedding, excluding <cls>/<eos> — same
    convention as extract_esm_features.py (so deltas are comparable)."""
    tok, model = _esm()
    out = []
    for i in range(0, len(seqs), batch_size):
        chunk = seqs[i : i + batch_size]
        enc = tok(chunk, return_tensors="pt", padding=True, truncation=True, max_length=1022)
        with torch.no_grad():
            hs = model(**enc).hidden_states[-1]  # (B, L, D)  == encoder last_hidden_state
        mask = enc["attention_mask"].clone()
        mask[:, 0] = 0  # drop <cls>
        for j, n in enumerate(enc["attention_mask"].sum(dim=1)):
            mask[j, n - 1] = 0  # drop <eos>
        mask = mask.unsqueeze(-1).float()
        pooled = (hs * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1)
        out.append(pooled.cpu().numpy())
    return np.vstack(out)


def apply_mutation(wt_seq, mutation):
    a, pos, b = mutation[0], int(mutation[1:-1]), mutation[-1]
    if wt_seq[pos - 1] != a:
        raise ValueError(f"{mutation}: WT[{pos}]={wt_seq[pos-1]} != {a}")
    s = list(wt_seq)
    s[pos - 1] = b
    return "".join(s)


def zeroshot_scores(wt_seq, mutations, batch_size=16):
    """ESM-2 masked-marginal log-odds: log P(mut) - log P(wt) at the masked
    position. Masks each unique position once, then reads off each mutation."""
    tok, model = _esm()
    positions = sorted({int(m[1:-1]) for m in mutations})
    base = tok(wt_seq, return_tensors="pt")
    input_ids = base["input_ids"]
    attn = base["attention_mask"]
    mask_id = tok.mask_token_id
    logprob_at = {}
    for i in range(0, len(positions), batch_size):
        chunk = positions[i : i + batch_size]
        ids = input_ids.repeat(len(chunk), 1).clone()
        att = attn.repeat(len(chunk), 1)
        for r, pos in enumerate(chunk):
            ids[r, pos] = mask_id  # token index == 1-indexed residue position (<cls> is token 0)
        with torch.no_grad():
            logits = model(input_ids=ids, attention_mask=att).logits
        lp = torch.log_softmax(logits, dim=-1)
        for r, pos in enumerate(chunk):
            logprob_at[pos] = lp[r, pos].cpu().numpy()
    scores = []
    for m in mutations:
        a, pos, b = m[0], int(m[1:-1]), m[-1]
        lp = logprob_at[pos]
        scores.append(float(lp[tok.convert_tokens_to_ids(b)] - lp[tok.convert_tokens_to_ids(a)]))
    return scores


def residue_hidden(seqs):
    """Per-residue last hidden state (B, L, D) — same tensor family the per-position
    features were extracted from (matches to ~5e-7, verified in ML-1)."""
    tok, model = _esm()
    enc = tok(seqs, return_tensors="pt", padding=True, truncation=True, max_length=1022)
    with torch.no_grad():
        hs = model(**enc).hidden_states[-1]
    return hs.cpu().numpy()


def perpos_delta(wt_seq, mutation):
    """Mutation-site residue delta: hidden(variant)[pos] - hidden(WT)[pos].
    pos = 1-indexed residue = token index (<cls> is token 0)."""
    if wt_seq not in _WT_RES:
        _WT_RES[wt_seq] = residue_hidden([wt_seq])[0]  # (L, D), cached across calls
    wt_res = _WT_RES[wt_seq]
    var_seq = apply_mutation(wt_seq, mutation)
    var_res = residue_hidden([var_seq])[0]
    pos = int(mutation[1:-1])
    return var_res[pos] - wt_res[pos]


def load_artifact(path=ARTIFACT):
    with open(path) as f:
        return json.load(f)


_ARTIFACTS: dict = {}


def _artifact(path):
    if path not in _ARTIFACTS:
        _ARTIFACTS[path] = load_artifact(path)
    return _ARTIFACTS[path]


def predict_variant(wt_seq, mutation=None, variant_seq=None):
    """Product prediction path. With a `mutation` (the normal case) → per-position
    Ridge (the validated winner) + zero-shot. With only a `variant_seq` (site
    unknown) → fall back to the mean-pooled model, no zero-shot."""
    zeroshot = zeroshot_scores(wt_seq, [mutation])[0] if mutation else None
    if mutation:
        art = _artifact(PERPOS_ARTIFACT)
        delta = perpos_delta(wt_seq, mutation)
        pf = float(delta @ np.asarray(art["coef"], dtype=float) + float(art["intercept"]))
        return {
            "predicted_fitness": pf,
            "zeroshot_score": zeroshot,
            "feature": "perpos_delta",
            "variant_seq_len": len(apply_mutation(wt_seq, mutation)),
        }
    # variant_seq only: cannot locate the mutated site → mean-pooled fallback.
    art = _artifact(ARTIFACT)
    v_emb = embed([variant_seq])[0]
    delta = v_emb - np.asarray(art["wt_embedding"], dtype=float)
    pf = float(delta @ np.asarray(art["coef"], dtype=float) + float(art["intercept"]))
    return {"predicted_fitness": pf, "zeroshot_score": None, "feature": "meanpool_delta", "variant_seq_len": len(variant_seq)}


def predict_one(art, wt_seq, mutation=None, variant_seq=None):
    """Return {predicted_fitness, zeroshot_score} for one variant."""
    coef = np.asarray(art["coef"], dtype=float)
    intercept = float(art["intercept"])
    wt_emb = np.asarray(art["wt_embedding"], dtype=float)
    if variant_seq is None:
        if mutation is None:
            raise ValueError("provide either mutation or variant_seq")
        variant_seq = apply_mutation(wt_seq, mutation)
    v_emb = embed([variant_seq])[0]
    delta = v_emb - wt_emb
    predicted_fitness = float(delta @ coef + intercept)
    zeroshot = zeroshot_scores(wt_seq, [mutation])[0] if mutation else None
    return {"predicted_fitness": predicted_fitness, "zeroshot_score": zeroshot, "variant_seq_len": len(variant_seq)}


# ── build: add WT seq + embedding to the artifact, verify delta convention ────
def cmd_build(args):
    from huggingface_hub import hf_hub_download

    ref_p = hf_hub_download(
        "OATML-Markslab/ProteinGym", "ProteinGym_reference_file_substitutions.csv", repo_type="dataset"
    )
    import pandas as pd

    ref = pd.read_csv(ref_p)
    wt = str(ref[ref["DMS_id"] == "BLAT_ECOLX_Stiffler_2015"]["target_seq"].iloc[0])
    wt_emb = embed([wt])[0]

    # Verify: delta for real variants matches features.json (training convention).
    # Uses features.json's own `mutants` so the check aligns exactly with X[i].
    feats = json.load(open(args.features))
    mutants = feats["mutants"]
    check_idx = [0, 100, 2500, len(mutants) - 1]
    deltas = embed([apply_mutation(wt, mutants[i]) for i in check_idx]) - wt_emb
    max_err = max(
        float(np.abs(deltas[k] - np.asarray(feats["X"][i], dtype=float)).max()) for k, i in enumerate(check_idx)
    )
    print(f"WT len={len(wt)}  delta-vs-features.json max|Δ| over {len(check_idx)} variants = {max_err:.2e}")

    art = load_artifact(args.artifact)
    art["wt_seq"] = wt
    art["wt_embedding"] = [round(float(x), 6) for x in wt_emb]
    art["wt_embedding_note"] = f"ESM-2 mean-pooled (excl cls/eos); delta-consistency vs features.json max|Δ|={max_err:.2e}"
    json.dump(art, open(args.artifact, "w"), indent=2)
    print(f"wrote WT seq + embedding into {args.artifact}")


# ── eval: zero-shot Spearman over the assay (full + same hold-out) ────────────
def cmd_eval(args):
    from scipy.stats import spearmanr

    art = load_artifact(args.artifact)
    wt = art["wt_seq"]
    feats = json.load(open(args.features))
    muts = [str(m) for m in feats["mutants"]]
    y = np.asarray(feats["y"], dtype=float)
    npos = len({int(m[1:-1]) for m in muts})
    print(f"zero-shot: {len(muts)} variants, {npos} unique positions (masked-marginal, one pass per position) ...")
    zs = np.asarray(zeroshot_scores(wt, muts), dtype=float)

    rho_full, _ = spearmanr(zs, y)
    print(f"ZERO-SHOT Spearman (ESM-2 masked-marginal vs DMS), full assay = {rho_full:.4f}   n={len(muts)}")

    hold = art.get("holdout_indices")
    if hold:
        hi = np.asarray(hold, dtype=int)
        rho_hold, _ = spearmanr(zs[hi], y[hi])
        print(f"ZERO-SHOT Spearman, SAME 1500 hold-out            = {rho_hold:.4f}   n={len(hi)}")
    print(f"SUPERVISED Ridge Spearman, same 1500 hold-out     = {art.get('holdout_spearman'):.4f}")


def cmd_predict(args):
    art = _artifact(PERPOS_ARTIFACT)
    wt = args.wt_seq or art["wt_seq"]
    res = predict_variant(wt, mutation=args.mutation, variant_seq=args.variant_seq)
    print(json.dumps({"mutation": args.mutation, **res}, indent=2))


def cmd_serve(args):
    from fastapi import FastAPI
    from pydantic import BaseModel
    import uvicorn

    app = FastAPI(title="Nexus-Bio variant-effect service")
    art = _artifact(PERPOS_ARTIFACT)  # per-position is the product model

    class Req(BaseModel):
        wt_seq: str | None = None
        mutation: str | None = None
        variant_seq: str | None = None

    @app.get("/health")
    def health():
        return {"ok": True, "model": art["esm_model_id"], "assay": art["assay"], "dim": art["dim"], "feature": art["feature"]}

    @app.post("/predict")
    def predict(req: Req):
        wt = req.wt_seq or art["wt_seq"]
        return predict_variant(wt, mutation=req.mutation, variant_seq=req.variant_seq)

    uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    default_assay = os.path.join(
        os.path.expanduser("~"), "Downloads", "Telegram Desktop", "BLAT_ECOLX_Stiffler_2015_withseq.csv"
    )
    default_feats = os.path.join(os.path.expanduser("~"), "Downloads", "Telegram Desktop", "features.json")
    for name, fn in [("build", cmd_build), ("eval", cmd_eval), ("predict", cmd_predict), ("serve", cmd_serve)]:
        p = sub.add_parser(name)
        p.add_argument("--artifact", default=ARTIFACT)
        p.add_argument("--assay", default=default_assay)
        p.add_argument("--features", default=default_feats)
        p.add_argument("--wt_seq", default=None)
        p.add_argument("--mutation", default=None)
        p.add_argument("--variant_seq", default=None)
        p.add_argument("--port", type=int, default=8077)
        p.set_defaults(func=fn)
    args = ap.parse_args()
    args.func(args)
