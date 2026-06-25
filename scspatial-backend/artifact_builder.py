"""Convert processed AnnData → Nexus-Bio JSON artifact.

Transforms scanpy/squidpy results into the ScSpatialNormalizedArtifact
format that the TypeScript frontend expects.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

import anndata as ad
import numpy as np
import pandas as pd
from scipy import sparse


def _sanitize_value(value: Any) -> Any:
    """Convert numpy/pandas values to JSON-safe Python types."""
    if value is None:
        return None
    if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
        return None
    if hasattr(value, "item"):
        return _sanitize_value(value.item())
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _matrix_to_sparse_rows(matrix: Any) -> Dict[str, Any]:
    """Convert a matrix to row-sparse JSON format."""
    if sparse.issparse(matrix):
        csr = matrix.tocsr()
        rows = []
        for i in range(csr.shape[0]):
            row = csr.getrow(i)
            rows.append({
                "indices": row.indices.tolist(),
                "values": row.data.astype(float).tolist(),
            })
    else:
        dense = np.asarray(matrix)
        rows = []
        for i in range(dense.shape[0]):
            row = dense[i]
            nonzero = np.nonzero(row)[0]
            rows.append({
                "indices": nonzero.astype(int).tolist(),
                "values": row[nonzero].astype(float).tolist(),
            })

    return {
        "encoding": "row-sparse-v1",
        "nObs": int(matrix.shape[0]),
        "nVars": int(matrix.shape[1]),
        "rows": rows,
    }


def _extract_moran_i(adata: ad.AnnData) -> List[Dict[str, Any]]:
    """Extract Moran's I results from adata.uns."""
    key = "moranI" if "moranI" in adata.uns else "gearyC"
    if key not in adata.uns:
        return []

    df = adata.uns[key]
    if not isinstance(df, pd.DataFrame):
        return []

    results = []
    for gene in df.index:
        row = df.loc[gene]
        results.append({
            "gene": str(gene),
            "I": _sanitize_value(row.get("I", row.get("C", 0))),
            "pval": _sanitize_value(row.get("pval", 1)),
            "pval_adj": _sanitize_value(row.get("pval_adj", 1)),
        })
    return sorted(results, key=lambda x: x.get("I", 0) or 0, reverse=True)


def _extract_marker_genes(adata: ad.AnnData, n_top: int = 10) -> Dict[str, List[Dict[str, Any]]]:
    """Extract marker genes from rank_genes_groups."""
    if "rank_genes_groups" not in adata.uns:
        return {}

    rgg = adata.uns["rank_genes_groups"]
    clusters = rgg["names"].dtype.names
    result = {}

    for cluster in clusters:
        genes = []
        for i in range(min(n_top, len(rgg["names"][cluster]))):
            genes.append({
                "gene": str(rgg["names"][cluster][i]),
                "logFC": _sanitize_value(rgg["logfoldchanges"][cluster][i]),
                "pval_adj": _sanitize_value(rgg["pvals_adj"][cluster][i]),
                "score": _sanitize_value(rgg["scores"][cluster][i]),
            })
        result[str(cluster)] = genes

    return result


def _extract_nhood_enrichment(adata: ad.AnnData, cluster_key: str = "leiden") -> Optional[Dict[str, Any]]:
    """Extract neighborhood enrichment results."""
    key = f"{cluster_key}_nhood_enrichment"
    if key not in adata.uns:
        return None

    data = adata.uns[key]
    zscore = data.get("zscore", None)
    count = data.get("count", None)

    if zscore is None:
        return None

    clusters = sorted(adata.obs[cluster_key].unique().tolist())

    return {
        "clusters": [str(c) for c in clusters],
        "zscore": zscore.tolist() if hasattr(zscore, "tolist") else zscore,
        "count": count.tolist() if hasattr(count, "tolist") else count,
    }


def _extract_ligrec(adata: ad.AnnData, cluster_key: str = "leiden") -> Optional[Dict[str, Any]]:
    """Extract ligand-receptor interaction results."""
    key = f"{cluster_key}_ligrec"
    if key not in adata.uns:
        return None

    data = adata.uns[key]
    means = data.get("means", None)
    pvalues = data.get("pvalues", None)

    if means is None:
        return None

    # Convert to serializable format
    result: Dict[str, Any] = {}

    if isinstance(means, pd.DataFrame):
        result["means"] = {
            "index": means.index.tolist(),
            "columns": means.columns.tolist(),
            "data": means.values.tolist(),
        }
    elif hasattr(means, "tolist"):
        result["means"] = means.tolist()

    if isinstance(pvalues, pd.DataFrame):
        result["pvalues"] = {
            "index": pvalues.index.tolist(),
            "columns": pvalues.columns.tolist(),
            "data": pvalues.values.tolist(),
        }
    elif hasattr(pvalues, "tolist"):
        result["pvalues"] = pvalues.tolist()

    return result if result else None


def _extract_paga(adata: ad.AnnData) -> Optional[Dict[str, Any]]:
    """Extract PAGA connectivity results."""
    if "paga" not in adata.uns:
        return None

    paga = adata.uns["paga"]
    connectivities = paga.get("connectivities", None)

    if connectivities is None:
        return None

    if sparse.issparse(connectivities):
        connectivities = connectivities.toarray()

    return {
        "connectivities": connectivities.tolist() if hasattr(connectivities, "tolist") else connectivities,
        "confidence": paga.get("confidence", None),
    }


def build_artifact(
    adata: ad.AnnData,
    artifact_id: str,
    file_name: str,
    uploaded_at: int,
) -> Dict[str, Any]:
    """Convert processed AnnData to Nexus-Bio artifact JSON.

    Args:
        adata: Processed AnnData (after run_full_pipeline)
        artifact_id: Unique artifact identifier
        file_name: Original file name
        uploaded_at: Upload timestamp (ms)

    Returns:
        Dict matching ScSpatialNormalizedArtifact TypeScript type
    """
    import sys

    # ── Extract obs metadata ────────────────────────────────────────
    obs_records = []
    for i, cell_id in enumerate(adata.obs_names):
        row = adata.obs.iloc[i]
        record: Dict[str, Any] = {"cellId": str(cell_id)}

        # Standard fields
        for src_key, dst_key in [
            ("leiden", "clusterLabel"),
            ("cell_type", "cellType"),
            ("celltype", "cellType"),
            ("batch", "batchId"),
            ("sample_id", "sampleId"),
            ("condition", "condition"),
            ("replicate", "replicate"),
        ]:
            if src_key in adata.obs.columns:
                record[dst_key] = _sanitize_value(row.get(src_key))

        # If no cellType found, use leiden cluster as fallback
        if record.get("cellType") is None and record.get("clusterLabel") is not None:
            record["cellType"] = record["clusterLabel"]

        # Pseudotime
        if "dpt_pseudotime" in adata.obs.columns:
            record["pseudotime"] = _sanitize_value(row.get("dpt_pseudotime"))

        obs_records.append(record)

    # ── Extract var metadata ────────────────────────────────────────
    var_records = []
    for gene_id in adata.var_names:
        gene_symbol = gene_id
        if "gene_symbol" in adata.var.columns:
            gene_symbol = str(adata.var.loc[gene_id, "gene_symbol"])
        elif "gene_names" in adata.var.columns:
            gene_symbol = str(adata.var.loc[gene_id, "gene_names"])
        var_records.append({"geneId": str(gene_id), "geneSymbol": str(gene_symbol)})

    # ── Extract embeddings ──────────────────────────────────────────
    embeddings: Dict[str, Any] = {}

    if "X_umap" in adata.obsm:
        umap = adata.obsm["X_umap"]
        embeddings["X_umap"] = {
            "dimensions": int(umap.shape[1]),
            "points": umap.tolist(),
        }

    if "X_diffmap" in adata.obsm:
        diffmap = adata.obsm["X_diffmap"]
        embeddings["X_diffmap"] = {
            "dimensions": int(diffmap.shape[1]),
            "points": diffmap.tolist(),
        }

    # ── Extract spatial coordinates ─────────────────────────────────
    spatial = None
    if "spatial" in adata.obsm:
        spatial = adata.obsm["spatial"].tolist()

    # ── Determine available views ───────────────────────────────────
    has_spatial = spatial is not None and len(spatial) > 0
    has_umap = "X_umap" in adata.obsm
    has_clusters = "leiden" in adata.obs.columns

    # ── Build analysis results ──────────────────────────────────────
    analysis: Dict[str, Any] = {
        "moranI": _extract_moran_i(adata),
        "markerGenes": _extract_marker_genes(adata),
        "paga": _extract_paga(adata),
        "nhoodEnrichment": _extract_nhood_enrichment(adata),
        "ligrec": _extract_ligrec(adata),
        "qcMetrics": {
            "nCellsRaw": int(adata.uns.get("_qc_n_cells_raw", adata.n_obs)),
            "nCellsAfter": int(adata.n_obs),
            "nGenesRaw": int(adata.uns.get("_qc_n_genes_raw", adata.n_vars)),
            "nGenesAfter": int(adata.n_vars),
        },
    }

    # ── Build artifact ──────────────────────────────────────────────
    # Get cluster summary stats
    cluster_summaries = {}
    if has_clusters and has_spatial:
        for cluster in sorted(adata.obs["leiden"].unique().tolist(), key=str):
            mask = adata.obs["leiden"] == cluster
            cluster_cells = adata.obs[mask]
            cluster_summaries[str(cluster)] = {
                "cellCount": int(mask.sum()),
            }

    artifact = {
        "schemaVersion": 1,
        "artifactId": artifact_id,
        "source": {
            "fileName": file_name,
            "uploadedAt": uploaded_at,
            "sampleCount": 1,
            "parserVersion": "scspatial-scanpy/1.0.0",
            "pythonVersion": sys.version.split(" ")[0],
        },
        "matrix": {
            "X": _matrix_to_sparse_rows(adata.X),
            "layers": {},
            "defaultLayer": "X",
        },
        "obs": obs_records,
        "var": var_records,
        "obsm": {
            "spatial": spatial,
            "embeddings": embeddings,
        },
        "metadata": {
            "warnings": list(adata.uns.get("_warnings", [])),
            "missingFields": [],
            "availableViews": {
                "spatial2d": has_spatial,
                "spatial3d": has_spatial,
                "umap": has_umap,
                "trajectory": has_clusters,
                "table": True,
            },
            "extractedKeys": {
                "layers": list(adata.layers.keys()),
                "embeddings": list(embeddings.keys()),
                "clusterLabelKey": "leiden",
                "cellTypeKey": "leiden",
                "batchKey": None,
                "sampleMetadataKeys": [],
            },
            "hasSpatialCoords": has_spatial,
            "hasClusterLabels": has_clusters,
            "hasPrecomputedUmap": has_umap,
        },
        "analysis": analysis,
    }

    # ── H&E image extraction (Visium) ─────────────────────────────────
    he_image = None
    if 'spatial' in adata.uns and isinstance(adata.uns['spatial'], dict):
        for lib_id, lib_data in adata.uns['spatial'].items():
            if isinstance(lib_data, dict) and 'images' in lib_data:
                images = lib_data['images']
                if 'hires' in images:
                    import base64
                    from io import BytesIO
                    from PIL import Image
                    img_array = images['hires']
                    if img_array.max() <= 1.0:
                        img_array = (img_array * 255).astype(np.uint8)
                    img = Image.fromarray(img_array)
                    buf = BytesIO()
                    img.save(buf, format='PNG')
                    he_image = {
                        'data': base64.b64encode(buf.getvalue()).decode(),
                        'scaleFactor': lib_data.get('scalefactors', {}).get('tissue_hires_scalef', 1.0),
                        'spotDiameter': lib_data.get('scalefactors', {}).get('spot_diameter_fullres', 1.0),
                    }
                    break

    spatial_format = adata.uns.get('_spatial_format', 'none')
    artifact['heImage'] = he_image
    artifact['spatialFormat'] = spatial_format

    return artifact
