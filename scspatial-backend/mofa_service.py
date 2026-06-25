"""MOFA+ multi-omics factor analysis service."""
from __future__ import annotations
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import logging

logger = logging.getLogger(__name__)

def run_mofa_analysis(
    views: Dict[str, np.ndarray],
    sample_names: List[str],
    feature_names: Dict[str, List[str]],
    n_factors: int = 10,
    n_iterations: int = 1000,
    convergence_mode: str = "medium",
) -> Dict[str, Any]:
    """Run MOFA+ factor analysis on multi-omics data.

    Args:
        views: {view_name: (n_samples, n_features) array}
        sample_names: list of sample IDs
        feature_names: {view_name: list of feature names}
        n_factors: number of latent factors
        n_iterations: max iterations
        convergence_mode: "fast", "medium", or "slow"

    Returns:
        Dict with factors, variance_explained, feature_weights
    """
    try:
        from mofapy2.run.entry_point import entry_point
    except ImportError:
        raise RuntimeError("mofapy2 is not installed. Run: pip install mofapy2")

    ent = entry_point()

    # Prepare data in mofapy2 format: list of matrices per view
    view_names = list(views.keys())
    data_matrices = [views[v].tolist() for v in view_names]
    features = [feature_names.get(v, [f"f{j}" for j in range(views[v].shape[1])]) for v in view_names]
    likelihoods = ["gaussian"] * len(view_names)

    # Set data matrices
    ent.set_data_matrix(
        data=data_matrices,
        views_names=view_names,
        samples_names=[sample_names],
        features_names=features,
        likelihoods=likelihoods,
    )

    # Set model options
    ent.set_model_options(factors=n_factors)
    ent.set_train_options(iter=n_iterations, convergence_mode=convergence_mode)

    # Build and run
    ent.build()
    ent.run()

    # Extract results from the model
    model = ent.model

    # Get factors (Z matrix: samples x factors)
    factors_data = model.get_factors()
    factors = {}
    for i in range(n_factors):
        factor_key = f"factor_{i}"
        factors[factor_key] = {
            sample_names[j]: float(factors_data[0][j, i]) if j < len(sample_names) else 0.0
            for j in range(len(sample_names))
        }

    # Get variance explained per view per factor
    r2 = model.calculate_variance_explained()
    variance_explained = {}
    for view_idx, view_name in enumerate(views.keys()):
        variance_explained[view_name] = [
            float(r2[0][view_idx][f]) if r2[0] is not None and view_idx < len(r2[0]) and f < len(r2[0][view_idx]) else 0.0
            for f in range(n_factors)
        ]

    # Get feature weights (W matrix)
    weights = model.get_weights()
    feature_weights = {}
    for view_idx, view_name in enumerate(views.keys()):
        feature_weights[view_name] = {}
        fnames = feature_names.get(view_name, [f"f{j}" for j in range(weights[0][view_idx].shape[0])])
        for f in range(n_factors):
            factor_key = f"factor_{f}"
            feature_weights[view_name][factor_key] = {
                fnames[j]: float(weights[0][view_idx][j, f])
                for j in range(min(len(fnames), weights[0][view_idx].shape[0]))
            }

    return {
        "factors": factors,
        "variance_explained": variance_explained,
        "feature_weights": feature_weights,
        "n_factors": n_factors,
        "n_samples": len(sample_names),
        "n_views": len(views),
    }
