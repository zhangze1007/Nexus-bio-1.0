"""Scanpy/Squidpy analysis pipeline for spatial transcriptomics.

Runs the full preprocessing → clustering → trajectory → spatial analysis
pipeline using real scanpy and squidpy libraries.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional

import anndata as ad
import numpy as np
import pandas as pd
import scanpy as sc
import squidpy as sq
from scipy import sparse

from models import AnalysisConfig

logger = logging.getLogger(__name__)

# Type for progress callback
ProgressCallback = Callable[[float, str, str], None]


def _noop_progress(progress: float, stage: str, message: str) -> None:
    pass


def run_full_pipeline(
    adata: ad.AnnData,
    config: AnalysisConfig,
    on_progress: ProgressCallback = _noop_progress,
) -> ad.AnnData:
    """Run the complete scanpy/squidpy spatial transcriptomics pipeline.

    Args:
        adata: Raw AnnData object (unprocessed)
        config: Analysis parameters
        on_progress: Callback(progress 0-1, stage_name, message)

    Returns:
        Processed AnnData with all computed results in obs/var/uns/obsm/obsp
    """
    n_cells_raw = adata.n_obs
    n_genes_raw = adata.n_vars

    # ── Step 1: QC ──────────────────────────────────────────────────
    on_progress(0.05, "qc", "Computing QC metrics")

    adata.var["mt"] = adata.var_names.str.startswith(("MT-", "mt-"))
    sc.pp.calculate_qc_metrics(adata, qc_vars=["mt"], inplace=True, log1p=False)

    on_progress(0.08, "qc", f"Filtering cells (min_counts={config.qc.min_counts}, min_genes={config.qc.min_genes})")

    n_before = adata.n_obs
    sc.pp.filter_cells(adata, min_counts=config.qc.min_counts)
    sc.pp.filter_cells(adata, min_genes=config.qc.min_genes)
    n_after_cells = adata.n_obs

    on_progress(0.10, "qc", f"Filtering genes (min_cells=3)")

    sc.pp.filter_genes(adata, min_cells=3)
    n_after_genes = adata.n_vars

    # Filter by mito percent
    if "pct_counts_mt" in adata.obs.columns:
        mask = adata.obs["pct_counts_mt"] < config.qc.max_mito_percent
        adata = adata[mask].copy()
        on_progress(0.12, "qc", f"Mito filter: {n_after_cells} → {adata.n_obs} cells")

    on_progress(0.15, "qc", f"QC done: {n_cells_raw} → {adata.n_obs} cells, {n_genes_raw} → {adata.n_vars} genes")

    # ── Step 2: Normalization ───────────────────────────────────────
    on_progress(0.18, "normalize", "Normalizing (library-size → log1p)")

    sc.pp.normalize_total(adata, target_sum=config.normalization.target_sum)
    sc.pp.log1p(adata)

    # Store raw for later use (marker gene visualization, ligrec)
    adata.raw = adata

    on_progress(0.22, "normalize", "Normalization complete")

    # ── Step 3: HVG Selection ───────────────────────────────────────
    on_progress(0.25, "hvg", f"Selecting {config.hvg.n_top_genes} HVGs (flavor={config.hvg.flavor})")

    sc.pp.highly_variable_genes(
        adata,
        n_top_genes=config.hvg.n_top_genes,
        flavor=config.hvg.flavor,
    )

    n_hvg = adata.var["highly_variable"].sum()
    on_progress(0.30, "hvg", f"Found {n_hvg} highly variable genes")

    # ── Step 4: Scaling ─────────────────────────────────────────────
    on_progress(0.32, "scale", "Scaling data (max_value=10)")

    sc.pp.scale(adata, max_value=10)

    # ── Step 5: PCA ─────────────────────────────────────────────────
    on_progress(0.35, "pca", f"Running PCA (n_comps=50)")

    sc.tl.pca(adata, n_comps=50, use_highly_variable=True, svd_solver="arpack")

    # ── Step 6: Neighbors ───────────────────────────────────────────
    on_progress(0.40, "neighbors", f"Building KNN graph (n_neighbors={config.clustering.n_neighbors}, n_pcs={config.clustering.n_pcs})")

    sc.pp.neighbors(
        adata,
        n_neighbors=config.clustering.n_neighbors,
        n_pcs=config.clustering.n_pcs,
    )

    # ── Step 7: UMAP ────────────────────────────────────────────────
    on_progress(0.45, "umap", "Computing UMAP embedding")

    sc.tl.umap(adata, min_dist=0.5)

    # ── Step 8: Leiden Clustering ───────────────────────────────────
    on_progress(0.50, "cluster", f"Leiden clustering (resolution={config.clustering.resolution})")

    sc.tl.leiden(adata, resolution=config.clustering.resolution, flavor="leidenalg")

    n_clusters = adata.obs["leiden"].nunique()
    on_progress(0.55, "cluster", f"Found {n_clusters} clusters")

    # ── Step 9: PAGA ────────────────────────────────────────────────
    on_progress(0.58, "paga", "Computing PAGA trajectory")

    sc.tl.paga(adata, groups="leiden")
    sc.pl.paga(adata, plot=False)  # Set PAGA-initialized positions

    # ── Step 10: Diffusion Map + Pseudotime ─────────────────────────
    on_progress(0.62, "diffusion", "Computing diffusion map")

    sc.tl.diffmap(adata, n_comps=15)

    # Set root cell as the one with highest diffusion component 1
    adata.uns["iroot"] = np.argmax(adata.obsm["X_diffmap"][:, 1])

    on_progress(0.65, "pseudotime", "Computing diffusion pseudotime")

    sc.tl.dpt(adata, n_dcs=10)

    # ── Step 11: Marker Genes ───────────────────────────────────────
    on_progress(0.68, "markers", "Finding marker genes (Wilcoxon)")

    sc.tl.rank_genes_groups(adata, "leiden", method="wilcoxon", corr_method="benjamini-hochberg")

    # ── Step 12: Spatial Neighbors (squidpy) ────────────────────────
    has_spatial = "spatial" in adata.obsm

    if has_spatial:
        on_progress(0.72, "spatial", f"Building spatial neighbor graph (n_neighs={config.spatial.n_neighs})")

        sq.gr.spatial_neighbors(
            adata,
            n_neighs=config.spatial.n_neighs,
            delaunay=config.spatial.delaunay,
            coord_type=config.spatial.coord_type,
        )

        # ── Step 13: Moran's I ─────────────────────────────────────
        on_progress(0.78, "moran", f"Computing spatial autocorrelation ({config.spatial_autocorr.mode}, {config.spatial_autocorr.n_perms} perms)")

        # Run Moran's I on top HVGs (limit for performance)
        hvg_genes = adata.var_names[adata.var.get("highly_variable", pd.Series(False, index=adata.var_names))].tolist()
        genes_for_moran = hvg_genes[:min(len(hvg_genes), 500)]

        if genes_for_moran:
            sq.gr.spatial_autocorr(
                adata,
                mode=config.spatial_autocorr.mode,
                genes=genes_for_moran,
                n_perms=config.spatial_autocorr.n_perms,
                corr_method="fdr_bh",
            )

        # ── Step 14: Neighborhood Enrichment ───────────────────────
        on_progress(0.85, "nhood", "Computing neighborhood enrichment")

        sq.gr.nhood_enrichment(adata, cluster_key="leiden", n_perms=1000)

        # ── Step 15: Ligand-Receptor Analysis ──────────────────────
        on_progress(0.90, "ligrec", "Analyzing ligand-receptor interactions")

        try:
            sq.gr.ligrec(adata, cluster_key="leiden", use_raw=True, threshold=0.01)
        except Exception as e:
            logger.warning(f"ligrec failed (non-fatal): {e}")
            adata.uns["leiden_ligrec_error"] = str(e)
    else:
        on_progress(0.72, "spatial", "No spatial coordinates found — skipping spatial analysis")
        on_progress(0.90, "spatial", "Spatial analysis skipped")

    # ── Done ────────────────────────────────────────────────────────
    on_progress(1.0, "done", f"Pipeline complete: {adata.n_obs} cells, {adata.n_vars} genes, {n_clusters} clusters")

    return adata
