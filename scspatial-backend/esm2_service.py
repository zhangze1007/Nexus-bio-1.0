"""ESM-2 protein language model service."""
from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Model size options
ESM2_MODELS = {
    "esm2_t6_8M_UR50D": {"params": "8M", "layers": 6, "dim": 320, "memory_gb": 1.5},
    "esm2_t12_35M_UR50D": {"params": "35M", "layers": 12, "dim": 480, "memory_gb": 2.5},
    "esm2_t30_150M_UR50D": {"params": "150M", "layers": 30, "dim": 640, "memory_gb": 3.5},
    "esm2_t33_650M_UR50D": {"params": "650M", "layers": 33, "dim": 1280, "memory_gb": 6.0},
}

# Cache loaded models
_model_cache: Dict[str, Any] = {}


def _get_model(model_name: str):
    """Load and cache an ESM-2 model."""
    if model_name in _model_cache:
        return _model_cache[model_name]

    try:
        import torch
        import esm
    except ImportError:
        raise RuntimeError(
            "ESM-2 requires PyTorch and fair-esm. "
            "Install with: pip install torch fair-esm --extra-index-url https://download.pytorch.org/whl/cpu"
        )

    if model_name not in ESM2_MODELS:
        raise ValueError(f"Unknown model: {model_name}. Available: {list(ESM2_MODELS.keys())}")

    logger.info(f"Loading ESM-2 model: {model_name}")
    model, alphabet = esm.pretrained.load_model_and_alphabet(model_name)
    model.eval()

    if torch.cuda.is_available():
        model = model.cuda()
        logger.info("Using GPU for ESM-2")
    else:
        logger.info("Using CPU for ESM-2 (slower)")

    _model_cache[model_name] = (model, alphabet)
    return model, alphabet


def run_esm2_analysis(
    sequence: str,
    model_name: str = "esm2_t6_8M_UR50D",
    return_embeddings: bool = True,
    return_contacts: bool = False,
    fitness_mutations: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Run ESM-2 analysis on a protein sequence.

    Args:
        sequence: amino acid sequence (single letter codes)
        model_name: ESM-2 model to use
        return_embeddings: whether to return per-residue embeddings
        return_contacts: whether to return contact predictions
        fitness_mutations: list of mutations in "A42G" format for fitness scoring

    Returns:
        Dict with embeddings, contacts, fitness_scores
    """
    import torch
    import numpy as np

    model, alphabet = _get_model(model_name)
    batch_converter = alphabet.get_batch_converter()

    # Prepare input
    data = [("protein", sequence)]
    labels, strs, tokens = batch_converter(data)

    device = next(model.parameters()).device
    tokens = tokens.to(device)

    # Run inference
    with torch.no_grad():
        results = model(
            tokens,
            repr_layers=[model.num_layers],
            return_contacts=return_contacts,
        )

    response: Dict[str, Any] = {
        "sequence_length": len(sequence),
        "model": model_name,
        "model_info": ESM2_MODELS[model_name],
    }

    # Extract embeddings
    if return_embeddings:
        reps = results["representations"][model.num_layers]
        # Remove batch dim and BOS/EOS tokens
        residue_embs = reps[0, 1:-1].cpu().numpy()
        response["embeddings"] = residue_embs.tolist()
        response["mean_embedding"] = residue_embs.mean(axis=0).tolist()
        response["embedding_dim"] = residue_embs.shape[1]

    # Extract contacts
    if return_contacts and "contacts" in results:
        contacts = results["contacts"][0].cpu().numpy()
        response["contacts"] = contacts.tolist()

    # Fitness scoring via masked marginal probabilities
    if fitness_mutations:
        fitness = {}
        token_probs = torch.log_softmax(results["logits"], dim=-1)

        for mut in fitness_mutations:
            try:
                wt_aa = mut[0]
                pos = int(mut[1:-1])
                mut_aa = mut[-1]

                wt_idx = alphabet.get_idx(wt_aa)
                mut_idx = alphabet.get_idx(mut_aa)

                # Log-likelihood ratio: log P(mut) - log P(wt)
                score = (
                    token_probs[0, pos + 1, mut_idx] -
                    token_probs[0, pos + 1, wt_idx]
                ).item()
                fitness[mut] = round(score, 4)
            except (ValueError, IndexError) as e:
                fitness[mut] = None
                logger.warning(f"Failed to score mutation {mut}: {e}")

        response["fitness_scores"] = fitness

    return response


def get_esm2_models() -> Dict[str, Any]:
    """Return available ESM-2 models and their specifications."""
    return {
        "models": ESM2_MODELS,
        "default": "esm2_t6_8M_UR50D",
        "recommended_cpu": "esm2_t6_8M_UR50D",
        "recommended_gpu": "esm2_t33_650M_UR50D",
    }
