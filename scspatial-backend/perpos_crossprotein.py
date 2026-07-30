"""
perpos_crossprotein.py — cross-protein reproduction of the per-position variant-
effect pipeline on a second ProteinGym assay.

Same logic as extract_perpos_features.py (per-position ESM-2 delta) + the zero-shot
masked-marginal from variant_effect_service.py, generalized to any single-mutation
ProteinGym substitution assay. Real ESM-2 (esm2_t12_35M_UR50D) + real ProteinGym
data (HF OATML-Markslab/ProteinGym). WT from the official reference file; variant
sequences reconstructed deterministically (WT + real mutation) and verified per row.

Output (NOT committed): { dim, model, n, feature, dms, source, revision, X(n×480),
y, mutants, zeroshot, wt_len }.

Run (background): python scspatial-backend/perpos_crossprotein.py --dms PTEN_HUMAN_Mighell_2018 --out "<downloads>/features_perpos_pten.json"
"""

import argparse
import json

import numpy as np
import pandas as pd
import torch
from huggingface_hub import hf_hub_download
from transformers import AutoModelForMaskedLM, AutoTokenizer

REPO = "OATML-Markslab/ProteinGym"
MODEL_MAP = {
    "35M": "facebook/esm2_t12_35M_UR50D",
    "150M": "facebook/esm2_t30_150M_UR50D",
    "650M": "facebook/esm2_t33_650M_UR50D",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dms", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="35M", choices=list(MODEL_MAP))
    args = ap.parse_args()
    MODEL_ID = MODEL_MAP[args.model]

    ref_path = hf_hub_download(REPO, "ProteinGym_reference_file_substitutions.csv", repo_type="dataset")
    ref = pd.read_csv(ref_path)
    wt = str(ref[ref["DMS_id"] == args.dms]["target_seq"].iloc[0])

    assay_path = hf_hub_download(REPO, f"ProteinGym_substitutions/{args.dms}.csv", repo_type="dataset")
    a = pd.read_csv(assay_path)
    a = a[~a["mutant"].astype(str).str.contains(":")].dropna(subset=["DMS_score"]).reset_index(drop=True)
    mutants = a["mutant"].astype(str).tolist()
    y = [float(v) for v in a["DMS_score"].tolist()]
    n = len(mutants)

    # Deterministic reconstruction check: every single mutant's WT residue must match.
    for m in mutants:
        wa, pos = m[0], int(m[1:-1])
        if pos < 1 or pos > len(wt) or wt[pos - 1] != wa:
            raise SystemExit(f"WT/mutation mismatch at {m}: WT[{pos}]={wt[pos-1] if 1<=pos<=len(wt) else '?'} != {wa}")
    # revision hash of the downloaded snapshot (reproducibility)
    rev = ""
    try:
        import re as _re

        mt = _re.search(r"snapshots[\\/]([0-9a-f]{40})", assay_path)
        rev = mt.group(1) if mt else ""
    except Exception:
        rev = ""
    print(f"dms={args.dms} n={n} wt_len={len(wt)} revision={rev} (reconstruction verified 0 mismatches)")

    tok = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForMaskedLM.from_pretrained(MODEL_ID, output_hidden_states=True).eval()

    def apply_mut(m):
        s = list(wt)
        s[int(m[1:-1]) - 1] = m[-1]
        return "".join(s)

    def residue_hidden(seqs):
        enc = tok(seqs, return_tensors="pt", padding=True, truncation=True, max_length=1022)
        with torch.no_grad():
            hs = model(**enc).hidden_states[-1]  # (B,L,D) == encoder last_hidden_state
        return hs.cpu().numpy()

    # WT residue embeddings once; per-position delta = variant[pos] - WT[pos] (token idx = pos).
    wt_res = residue_hidden([wt])[0]
    rows = []
    bs = 16
    for i in range(0, n, bs):
        chunk = mutants[i : i + bs]
        var_res = residue_hidden([apply_mut(m) for m in chunk])
        for b, m in enumerate(chunk):
            pos = int(m[1:-1])
            rows.append(var_res[b, pos] - wt_res[pos])
        print(f"  perpos {min(i+bs,n)}/{n}", end="\r", flush=True)
    print()
    X = np.vstack(rows)

    # Zero-shot masked-marginal: mask each unique position once, read log-odds.
    positions = sorted({int(m[1:-1]) for m in mutants})
    base = tok(wt, return_tensors="pt")
    ids, att, mask_id = base["input_ids"], base["attention_mask"], tok.mask_token_id
    logprob_at = {}
    for i in range(0, len(positions), 16):
        chunk = positions[i : i + 16]
        b_ids = ids.repeat(len(chunk), 1).clone()
        b_att = att.repeat(len(chunk), 1)
        for r, pos in enumerate(chunk):
            b_ids[r, pos] = mask_id
        with torch.no_grad():
            logits = model(input_ids=b_ids, attention_mask=b_att).logits
        lp = torch.log_softmax(logits, dim=-1)
        for r, pos in enumerate(chunk):
            logprob_at[pos] = lp[r, pos].numpy()
        print(f"  zeroshot pos {min(i+16,len(positions))}/{len(positions)}", end="\r", flush=True)
    print()
    zeroshot = []
    for m in mutants:
        wa, pos, ma = m[0], int(m[1:-1]), m[-1]
        lp = logprob_at[pos]
        zeroshot.append(float(lp[tok.convert_tokens_to_ids(ma)] - lp[tok.convert_tokens_to_ids(wa)]))

    payload = {
        "dim": int(X.shape[1]),
        "model": MODEL_ID,
        "n": n,
        "feature": "perpos_delta",
        "dms": args.dms,
        "source": f"HF {REPO} ProteinGym_substitutions/{args.dms}.csv",
        "revision": rev,
        "wt_len": len(wt),
        "X": X.astype(float).round(6).tolist(),
        "y": y,
        "mutants": mutants,
        "zeroshot": zeroshot,
    }
    json.dump(payload, open(args.out, "w"))
    print(f"wrote {args.out}  shape=({X.shape[0]}, {X.shape[1]}) + zeroshot[{len(zeroshot)}]")


if __name__ == "__main__":
    main()
