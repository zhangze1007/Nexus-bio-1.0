#!/usr/bin/env python3
import base64
import json
import sys
from typing import Any, Dict, List, Optional


PARSER_VERSION = "scspatial-sidecar/1.0.0"
DEFAULT_SAMPLE_METADATA_CANDIDATES = [
    "sample",
    "sample_id",
    "sampleid",
    "condition",
    "replicate",
    "donor",
    "patient",
    "treatment",
    "timepoint",
    "time_point",
    "tissue",
    "region",
    "library_id",
]


def fail(message: str) -> None:
    raise RuntimeError(message)


def decode_payload(raw: str) -> Dict[str, Any]:
    padded = raw + "=" * (-len(raw) % 4)
    decoded = base64.urlsafe_b64decode(padded.encode("utf-8"))
    return json.loads(decoded.decode("utf-8"))


def first_existing(columns: List[str], candidates: List[str]) -> Optional[str]:
    lookup = {column.lower(): column for column in columns}
    for candidate in candidates:
        if candidate.lower() in lookup:
            return lookup[candidate.lower()]
    return None


def sanitize_value(value: Any) -> Optional[Any]:
    if value is None:
        return None
    if isinstance(value, float) and value != value:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    try:
        if hasattr(value, "item"):
            item = value.item()
            if isinstance(item, float) and item != item:
                return None
            if isinstance(item, (str, int, float, bool)):
                return item
    except Exception:
        pass
    return str(value)


def matrix_to_sparse_rows(matrix: Any) -> Dict[str, Any]:
    try:
        import numpy as np
        from scipy import sparse
    except ImportError as exc:
        fail(f"Missing scientific Python dependency: {exc}")

    if sparse.issparse(matrix):
        csr = matrix.tocsr()
        rows = []
        for index in range(csr.shape[0]):
            row = csr.getrow(index)
            rows.append({
                "indices": row.indices.tolist(),
                "values": row.data.astype(float).tolist(),
            })
    else:
        dense = np.asarray(matrix)
        rows = []
        for index in range(dense.shape[0]):
            row = dense[index]
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


def extract_embedding_payload(adata: Any, configured_keys: Optional[List[str]] = None) -> Dict[str, Any]:
    embeddings: Dict[str, Any] = {}
    obsm_keys = list(getattr(adata, "obsm_keys", lambda: [])())
    selected_keys = obsm_keys
    if configured_keys:
        resolved_keys = []
        for key in configured_keys:
            existing = first_existing(obsm_keys, [key])
            if existing and existing not in resolved_keys:
                resolved_keys.append(existing)
        selected_keys = resolved_keys
    for key in selected_keys:
        if key.lower() == "spatial":
            continue
        value = adata.obsm[key]
        shape = getattr(value, "shape", None)
        if not shape or len(shape) != 2:
            continue
        if shape[1] not in (2, 3):
            continue
        embeddings[str(key)] = {
            "dimensions": int(shape[1]),
            "points": value.tolist(),
        }
    return embeddings


def build_obs_records(adata: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    columns = list(adata.obs.columns)
    cluster_key = config.get("clusterKey") or first_existing(
        columns,
        ["cluster", "clusters", "leiden", "louvain", "seurat_clusters", "cell_type", "celltype"],
    )
    cell_type_key = config.get("cellTypeKey") or first_existing(
        columns,
        ["cellType", "cell_type", "celltype", "annotation", "cell_label"],
    )
    batch_key = config.get("batchKey") or first_existing(
        columns,
        ["batch", "batch_id", "batchid"],
    )
    configured_sample_keys = [
        key for key in (config.get("sampleMetadataKeys") or []) if isinstance(key, str) and key.strip()
    ]
    sample_id_key = first_existing(columns, configured_sample_keys + ["sample_id", "sample", "sampleid"])
    condition_key = first_existing(columns, configured_sample_keys + ["condition", "treatment"])
    replicate_key = first_existing(columns, configured_sample_keys + ["replicate"])

    inferred_sample_metadata_keys = []
    for candidate in configured_sample_keys + DEFAULT_SAMPLE_METADATA_CANDIDATES:
        existing = first_existing(columns, [candidate])
        if existing and existing not in inferred_sample_metadata_keys:
            inferred_sample_metadata_keys.append(existing)

    obs_records = []
    for index, obs_name in enumerate(adata.obs_names.tolist()):
        row = adata.obs.iloc[index]
        sample_metadata = {
            key: sanitize_value(row[key])
            for key in inferred_sample_metadata_keys
            if key not in {cluster_key, cell_type_key, batch_key, sample_id_key, condition_key, replicate_key}
        }
        obs_records.append({
            "cellId": str(obs_name),
            "clusterLabel": sanitize_value(row[cluster_key]) if cluster_key else None,
            "cellType": sanitize_value(row[cell_type_key]) if cell_type_key else None,
            "batchId": sanitize_value(row[batch_key]) if batch_key else None,
            "sampleId": sanitize_value(row[sample_id_key]) if sample_id_key else None,
            "condition": sanitize_value(row[condition_key]) if condition_key else None,
            "replicate": sanitize_value(row[replicate_key]) if replicate_key else None,
            "sampleMetadata": sample_metadata or None,
        })

    return {
        "records": obs_records,
        "clusterKey": cluster_key,
        "cellTypeKey": cell_type_key,
        "batchKey": batch_key,
        "sampleMetadataKeys": inferred_sample_metadata_keys,
    }


def build_var_records(adata: Any) -> List[Dict[str, str]]:
    columns = list(adata.var.columns)
    gene_symbol_key = first_existing(columns, ["geneSymbol", "gene_symbol", "symbol", "gene_name", "feature_name"])
    records = []
    for index, var_name in enumerate(adata.var_names.tolist()):
        row = adata.var.iloc[index]
        records.append({
            "geneId": str(var_name),
            "geneSymbol": str(sanitize_value(row[gene_symbol_key]) or var_name),
        })
    return records


def build_spatial_payload(adata: Any, requested_key: Optional[str]) -> Optional[List[List[float]]]:
    obsm_keys = list(getattr(adata, "obsm_keys", lambda: [])())
    spatial_key = first_existing(obsm_keys, [requested_key]) if requested_key else first_existing(obsm_keys, ["spatial"])
    if not spatial_key:
        return None
    spatial = adata.obsm[spatial_key]
    shape = getattr(spatial, "shape", None)
    if not shape or len(shape) != 2 or shape[1] < 2:
        return None
    return [[float(point[0]), float(point[1])] for point in spatial.tolist()]


def main() -> None:
    if len(sys.argv) < 3:
        fail("Usage: scspatial_sidecar.py <h5ad-path> <base64-payload>")

    try:
        import anndata as ad
    except ImportError as exc:
        fail(f"Missing required dependency: {exc}. Install anndata, numpy, scipy.")

    file_path = sys.argv[1]
    payload = decode_payload(sys.argv[2])
    artifact_id = str(payload["artifactId"])
    file_name = str(payload["fileName"])
    uploaded_at = int(payload["uploadedAt"])
    config = payload.get("config") or {}
    max_cells = int(config.get("maxCells") or 10000)
    configured_embedding_keys = [key for key in (config.get("embeddingKeys") or []) if isinstance(key, str)]
    configured_layer_keys = [key for key in (config.get("layerKeys") or []) if isinstance(key, str)]
    spatial_key = config.get("spatialKey")

    adata = ad.read_h5ad(file_path)
    if max_cells > 0 and adata.n_obs > max_cells:
        adata = adata[:max_cells].copy()

    obs_payload = build_obs_records(adata, config)
    var_payload = build_var_records(adata)
    embeddings = extract_embedding_payload(adata, configured_embedding_keys or None)
    spatial = build_spatial_payload(adata, spatial_key if isinstance(spatial_key, str) else None)
    selected_layer_keys = list(adata.layers.keys())
    if configured_layer_keys:
        resolved = []
        for key in configured_layer_keys:
            existing = first_existing(selected_layer_keys, [key])
            if existing and existing not in resolved:
                resolved.append(existing)
        selected_layer_keys = resolved
    layers = {
        str(layer_name): matrix_to_sparse_rows(adata.layers[layer_name])
        for layer_name in selected_layer_keys
    }

    sample_ids = {
        record["sampleId"]
        for record in obs_payload["records"]
        if record.get("sampleId") not in (None, "")
    }
    has_cluster_labels = any(record.get("clusterLabel") not in (None, "") for record in obs_payload["records"])
    has_precomputed_umap = any("umap" in key.lower() for key in embeddings.keys())
    missing_fields = []
    warnings = []

    if spatial is None:
        missing_fields.append(f"obsm.{spatial_key}" if isinstance(spatial_key, str) and spatial_key else "obsm.spatial")
        warnings.append("Spatial coordinates were not found under the requested obsm key; spatial views will stay disabled.")
    if not has_cluster_labels:
        missing_fields.append("obs.clusterLabel")
        warnings.append("Cluster labels were not found in obs; backend clustering fallback will be used.")
    if not has_precomputed_umap:
        warnings.append("No precomputed UMAP embedding found; backend UMAP fallback will be used.")

    output = {
        "schemaVersion": 1,
        "artifactId": artifact_id,
        "source": {
            "fileName": file_name,
            "uploadedAt": uploaded_at,
            "sampleCount": len(sample_ids) or 1,
            "parserVersion": PARSER_VERSION,
            "pythonVersion": sys.version.split(" ")[0],
        },
        "matrix": {
            "X": matrix_to_sparse_rows(adata.X),
            "layers": layers,
            "defaultLayer": "X",
        },
        "obs": obs_payload["records"],
        "var": var_payload,
        "obsm": {
            "spatial": spatial,
            "embeddings": embeddings,
        },
        "metadata": {
            "warnings": warnings,
            "missingFields": missing_fields,
            "availableViews": {
                "spatial2d": spatial is not None,
                "spatial3d": spatial is not None,
                "umap": has_precomputed_umap,
                "trajectory": has_cluster_labels,
                "table": True,
            },
            "extractedKeys": {
                "layers": list(layers.keys()),
                "embeddings": list(embeddings.keys()),
                "clusterLabelKey": obs_payload["clusterKey"],
                "cellTypeKey": obs_payload["cellTypeKey"],
                "batchKey": obs_payload["batchKey"],
                "sampleMetadataKeys": obs_payload["sampleMetadataKeys"],
            },
            "hasSpatialCoords": spatial is not None,
            "hasClusterLabels": has_cluster_labels,
            "hasPrecomputedUmap": has_precomputed_umap,
        },
    }
    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    main()
