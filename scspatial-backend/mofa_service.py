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

    # Prepare data in mofapy2 format
    # mofapy2 expects: data[groups][views] = 2D array
    view_names = list(views.keys())
    data_matrices = [[views[v] for v in view_names]]  # wrapped in list for groups
    features = [feature_names.get(v, [f"f{j}" for j in range(views[v].shape[1])]) for v in view_names]
    likelihoods = ["gaussian"] * len(view_names)

    # Set data matrices (mofapy2 expects numpy arrays)
    # mofapy2 calls sys.exit() on error, so we catch SystemExit
    try:
        ent.set_data_matrix(
            data=data_matrices,
            views_names=view_names,
            samples_names=[sample_names],  # list of lists for groups
            features_names=features,
            likelihoods=likelihoods,
        )
    except SystemExit as e:
        raise RuntimeError(f"mofapy2 data validation failed: invalid data format or dimensions")

    # Set model options
    ent.set_model_options(factors=n_factors)
    ent.set_train_options(iter=n_iterations, convergence_mode=convergence_mode)

    # Build and run
    ent.build()
    ent.run()

    # Extract results from the model
    model = ent.model

    # Get factors (Z matrix: samples x factors)
    try:
        factors_data = model.get_factors()
        # factors_data is typically a list of arrays (one per group)
        z = factors_data[0] if isinstance(factors_data, list) else factors_data
        factors = {}
        for i in range(min(n_factors, z.shape[1])):
            factor_key = f"factor_{i}"
            factors[factor_key] = {
                sample_names[j]: float(z[j, i])
                for j in range(min(len(sample_names), z.shape[0]))
            }
    except Exception as e:
        logger.warning(f"Failed to extract factors: {e}")
        factors = {}

    # Get variance explained per view per factor
    try:
        r2 = model.calculate_variance_explained()
        variance_explained = {}
        for view_idx, view_name in enumerate(views.keys()):
            if r2 is not None and len(r2) > 0 and view_idx < len(r2[0]):
                variance_explained[view_name] = [
                    float(r2[0][view_idx][f]) if f < len(r2[0][view_idx]) else 0.0
                    for f in range(n_factors)
                ]
            else:
                variance_explained[view_name] = [0.0] * n_factors
    except Exception as e:
        logger.warning(f"Failed to extract variance explained: {e}")
        variance_explained = {v: [0.0] * n_factors for v in views.keys()}

    # Get feature weights (W matrix)
    try:
        weights = model.get_weights()
        feature_weights = {}
        for view_idx, view_name in enumerate(views.keys()):
            feature_weights[view_name] = {}
            w = weights[0][view_idx] if isinstance(weights, list) else weights[view_idx]
            fnames = feature_names.get(view_name, [f"f{j}" for j in range(w.shape[0])])
            for f in range(min(n_factors, w.shape[1])):
                factor_key = f"factor_{f}"
                feature_weights[view_name][factor_key] = {
                    fnames[j]: float(w[j, f])
                    for j in range(min(len(fnames), w.shape[0]))
                }
    except Exception as e:
        logger.warning(f"Failed to extract feature weights: {e}")
        feature_weights = {}

    return {
        "factors": factors,
        "variance_explained": variance_explained,
        "feature_weights": feature_weights,
        "n_factors": n_factors,
        "n_samples": len(sample_names),
        "n_views": len(views),
    }
