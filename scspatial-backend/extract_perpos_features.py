"""
extract_perpos_features.py  —  per-position variant features (ML per-position re-test)

ML-1 found mean-pooled delta embeddings (→ Ridge 0.482) lose to zero-shot ESM
(0.551): averaging one residue's change over all 286 residues dilutes the signal.
This extraction instead takes the RESIDUE-LEVEL embedding difference AT THE
MUTATED POSITION — variant residue embedding minus WT residue embedding at that
one position — isolating the local single-mutation signal.

Same ESM-2 model/tokenizer/hidden-state as extract_esm_features.py (AutoModel,
last_hidden_state), so it is apples-to-apples with the mean-pooled features.json.
Rows are emitted in features.json's exact `mutants` order (and y is copied from
it), so the fixed seed-0 hold-out in learningCurve.mts selects the SAME variants.

Output features_perpos.json (NOT committed): { dim, model, n, X(N×480), y, mutants,
feature: "perpos_delta" }.

Run (background, ~7-10 min CPU):
    python scspatial-backend/extract_perpos_features.py
"""

import json
import os

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

MODEL_ID = "facebook/esm2_t12_35M_UR50D"
HERE = os.path.dirname(__file__)
ARTIFACT = os.path.join(HERE, "..", "benchmarks", "models", "blat_ecolx_ridge_v1.json")
TG = os.path.join(os.path.expanduser("~"), "Downloads", "Telegram Desktop")
FEATURES = os.path.join(TG, "features.json")          # mutant order + y (the mean-pooled run)
OUT = os.path.join(TG, "features_perpos.json")        # NOT committed


def apply_mutation(wt_seq, mutation):
    a, pos, b = mutation[0], int(mutation[1:-1]), mutation[-1]
    if wt_seq[pos - 1] != a:
        raise ValueError(f"{mutation}: WT[{pos}]={wt_seq[pos-1]} != {a}")
    s = list(wt_seq)
    s[pos - 1] = b
    return "".join(s)


def residue_states(seqs, tok, model, device):
    """last_hidden_state (B, L, D) — same tensor extract_esm_features.py pools over."""
    enc = tok(seqs, return_tensors="pt", padding=True, truncation=True, max_length=1022)
    enc = {k: v.to(device) for k, v in enc.items()}
    with torch.no_grad():
        out = model(**enc).last_hidden_state
    return out.cpu().numpy()


def main():
    feats = json.load(open(FEATURES))
    mutants = [str(m) for m in feats["mutants"]]
    y = feats["y"]
    wt = json.load(open(ARTIFACT))["wt_seq"]  # 286-aa BLAT WT (ML-1, verified)
    n = len(mutants)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device={device} model={MODEL_ID} n={n} wt_len={len(wt)}")
    tok = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModel.from_pretrained(MODEL_ID).to(device).eval()

    # WT residue embeddings once. Token index == 1-indexed residue position (<cls> is token 0).
    wt_res = residue_states([wt], tok, model, device)[0]  # (L, D)

    batch_size = 16
    rows = []
    for i in range(0, n, batch_size):
        chunk = mutants[i : i + batch_size]
        seqs = [apply_mutation(wt, m) for m in chunk]
        var_res = residue_states(seqs, tok, model, device)  # (B, L, D); all seqs same length
        for b, m in enumerate(chunk):
            pos = int(m[1:-1])
            rows.append(var_res[b, pos] - wt_res[pos])  # per-position delta (480,)
        print(f"  {min(i + batch_size, n)}/{n}", end="\r", flush=True)
    print()

    X = np.vstack(rows)
    assert X.shape == (n, wt_res.shape[1]), X.shape
    payload = {
        "dim": int(X.shape[1]),
        "model": MODEL_ID,
        "n": int(X.shape[0]),
        "feature": "perpos_delta",
        "feature_desc": "last_hidden_state[variant, pos] - last_hidden_state[WT, pos] at the mutated residue",
        "X": X.astype(float).round(6).tolist(),
        "y": [float(v) for v in y],
        "mutants": mutants,
    }
    json.dump(payload, open(OUT, "w"))
    print(f"wrote {OUT}  shape=({X.shape[0]}, {X.shape[1]})  feature=perpos_delta")


if __name__ == "__main__":
    main()
