"""Spatial Transcriptomics Backend — FastAPI service.

Runs the full scanpy/squidpy pipeline and serves results to the
Nexus-Bio Next.js frontend.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

# ── Workaround: anndata/scipy try to import torch. On Python 3.14, torch
#    DLLs fail to load. We don't need torch, so create a minimal stub.
try:
    import torch  # noqa: F401
except (OSError, ImportError):
    import types
    _torch_stub = types.ModuleType("torch")
    _torch_stub.Tensor = type("Tensor", (), {})  # type: ignore[attr-defined]
    _torch_stub.__version__ = "0.0.0"  # type: ignore[attr-defined]
    sys.modules["torch"] = _torch_stub  # type: ignore[assignment]

import anndata as ad
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from artifact_builder import build_artifact
from mofa_service import run_mofa_analysis
from models import AnalysisConfig, IngestResponse, JobStatus, QueryRequest
from pipeline import run_full_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Nexus-Bio Spatial Transcriptomics API",
    version="1.0.0",
    description="scanpy/squidpy backend for ScSpatial analysis",
)

# CORS — allow requests from the Next.js frontend
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory job store (use Redis in production) ───────────────────

jobs: Dict[str, Dict[str, Any]] = {}
artifacts: Dict[str, Dict[str, Any]] = {}


# ── Health check ────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "ok": True,
        "version": "1.0.0",
        "engine": "scanpy-squidpy",
        "jobs_active": sum(1 for j in jobs.values() if j.get("status") in ("queued", "running")),
        "artifacts_stored": len(artifacts),
    }


# ── Ingest: upload h5ad → run pipeline → store artifact ────────────

@app.post("/ingest", response_model=IngestResponse)
async def ingest(
    file: UploadFile = File(...),
    config_json: str = Form("{}"),
):
    """Upload a .h5ad or .zip (Space Ranger output) file and run the full analysis pipeline."""

    # Parse config
    try:
        config = AnalysisConfig.model_validate_json(config_json)
    except Exception:
        config = AnalysisConfig()

    # Validate file
    if not file.filename:
        raise HTTPException(400, "A file is required")

    fname_lower = file.filename.lower()
    is_h5ad = fname_lower.endswith(".h5ad")
    is_visium_zip = fname_lower.endswith(".zip")

    if not is_h5ad and not is_visium_zip:
        raise HTTPException(400, "Only .h5ad files or .zip (Space Ranger output) are accepted")

    job_id = f"scspatial-{uuid.uuid4().hex[:12]}"
    artifact_id = f"scspatial-{uuid.uuid4().hex[:12]}"
    uploaded_at = int(time.time() * 1000)

    # Save file to temp directory
    tmp_dir = tempfile.mkdtemp(prefix="scspatial-")
    safe_name = Path(file.filename).name.replace(" ", "_")
    tmp_path = os.path.join(tmp_dir, safe_name)

    try:
        content = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(500, f"Failed to save file: {e}")

    # Store job status
    jobs[job_id] = {
        "job_id": job_id,
        "status": "running",
        "progress": 0.0,
        "stage": "init",
        "message": "Starting analysis...",
        "artifact_id": artifact_id,
        "file_name": safe_name,
        "uploaded_at": uploaded_at,
        "config": config,
        "tmp_path": tmp_path,
        "tmp_dir": tmp_dir,
    }

    # Run pipeline in background thread
    asyncio.get_event_loop().run_in_executor(None, _run_pipeline, job_id)

    return IngestResponse(
        ok=True,
        job_id=job_id,
        artifactId=artifact_id,
        status="running",
    )


def _run_pipeline(job_id: str):
    """Run the scanpy pipeline in a background thread."""
    job = jobs[job_id]

    try:
        # Progress callback
        def on_progress(progress: float, stage: str, message: str):
            job["progress"] = progress
            job["stage"] = stage
            job["message"] = message
            logger.info(f"[{job_id}] {progress:.0%} | {stage} | {message}")

        # Load data — supports .h5ad and .zip (Space Ranger output)
        tmp_path = job["tmp_path"]
        is_visium_zip = tmp_path.lower().endswith(".zip")

        if is_visium_zip:
            on_progress(0.02, "load", "Extracting Space Ranger output from ZIP")
            import zipfile
            extract_dir = os.path.join(job["tmp_dir"], "visium_extract")
            os.makedirs(extract_dir, exist_ok=True)
            with zipfile.ZipFile(tmp_path, "r") as zf:
                zf.extractall(extract_dir)

            # Find the directory containing spatial/ and filtered_feature_bc_matrix/
            visium_root = _find_visium_root(extract_dir)
            if not visium_root:
                raise ValueError("ZIP does not contain a valid Space Ranger output (missing spatial/ or filtered_feature_bc_matrix/)")

            on_progress(0.04, "load", f"Reading Visium data from {os.path.basename(visium_root)}")
            adata = sc.read_visium(visium_root)
            coord_type = config.spatial.coord_type or "visium"
        else:
            on_progress(0.02, "load", "Loading .h5ad file")
            adata = ad.read_h5ad(tmp_path)
            coord_type = config.spatial.coord_type

        # Truncate if needed
        config: AnalysisConfig = job["config"]
        if adata.n_obs > config.max_cells:
            on_progress(0.03, "load", f"Subsampling {adata.n_obs} → {config.max_cells} cells")
            import random
            indices = sorted(random.sample(range(adata.n_obs), config.max_cells))
            adata = adata[indices].copy()

        # Override coord_type if Visium was detected
        if is_visium_zip:
            config.spatial.coord_type = coord_type

        # Store raw counts for ligrec
        if adata.raw is None and adata.X is not None:
            adata.raw = adata

        # Run pipeline
        adata = run_full_pipeline(adata, config, on_progress)

        # Build artifact JSON
        on_progress(0.95, "serialize", "Building artifact")
        artifact = build_artifact(adata, job["artifact_id"], job["file_name"], job["uploaded_at"])

        # Store artifact
        artifacts[job["artifact_id"]] = artifact

        # Update job
        job["status"] = "completed"
        job["progress"] = 1.0
        job["stage"] = "done"
        job["message"] = f"Analysis complete: {adata.n_obs} cells, {adata.n_vars} genes"

    except Exception as e:
        logger.exception(f"Pipeline failed for {job_id}")
        job["status"] = "failed"
        job["error"] = str(e)
        job["stage"] = "error"
        job["message"] = f"Pipeline failed: {e}"

    finally:
        # Cleanup temp files
        try:
            import shutil
            shutil.rmtree(job.get("tmp_dir", ""), ignore_errors=True)
        except Exception:
            pass


# ── Job status (SSE stream) ─────────────────────────────────────────

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    """Get job status as SSE stream."""
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")

    async def event_stream():
        while True:
            job = jobs[job_id]
            data = {
                "job_id": job["job_id"],
                "status": job["status"],
                "progress": job["progress"],
                "stage": job["stage"],
                "message": job["message"],
            }
            if job.get("error"):
                data["error"] = job["error"]

            yield f"data: {json.dumps(data)}\n\n"

            if job["status"] in ("completed", "failed"):
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Get completed artifact ──────────────────────────────────────────

@app.get("/result/{job_id}")
async def get_result(job_id: str):
    """Get the full artifact for a completed job."""
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")

    job = jobs[job_id]
    if job["status"] != "completed":
        raise HTTPException(202, detail={"status": job["status"], "progress": job["progress"]})

    artifact_id = job["artifact_id"]
    if artifact_id not in artifacts:
        raise HTTPException(500, "Artifact not found in store")

    return artifacts[artifact_id]


# ── Query: filter pre-computed results ──────────────────────────────

@app.post("/query")
async def query(request: QueryRequest):
    """Query a stored artifact with gene/cluster filters."""
    artifact_id = request.artifactId

    if artifact_id not in artifacts:
        raise HTTPException(404, f"Artifact {artifact_id} not found")

    artifact = artifacts[artifact_id]

    # Build a lightweight query response from the stored artifact
    response = _build_query_response(artifact, request)
    return response


def _build_query_response(artifact: Dict[str, Any], request: QueryRequest) -> Dict[str, Any]:
    """Convert artifact + query params into ScSpatialQueryResponse format."""
    obs = artifact.get("obs", [])
    var = artifact.get("var", [])
    obsm = artifact.get("obsm", {})
    analysis = artifact.get("analysis", {})
    metadata = artifact.get("metadata", {})

    # Build gene list
    gene_symbols = [v["geneSymbol"] for v in var]

    # Build cluster list
    cluster_labels = sorted(set(
        o.get("clusterLabel", "Unknown") for o in obs if o.get("clusterLabel")
    ))

    # Select gene for expression coloring
    selected_gene = request.selectedGene or (gene_symbols[0] if gene_symbols else "")
    gene_idx = None
    for i, v in enumerate(var):
        if v["geneSymbol"] == selected_gene or v["geneId"] == selected_gene:
            gene_idx = i
            break

    # Build points from sparse matrix
    matrix = artifact.get("matrix", {}).get("X", {})
    rows = matrix.get("rows", [])
    spatial = obsm.get("spatial", [])
    embeddings = obsm.get("embeddings", {})
    umap_points = embeddings.get("X_umap", {}).get("points", [])

    points = []
    for i, cell in enumerate(obs):
        # Expression value for selected gene
        expr = 0.0
        if gene_idx is not None and i < len(rows):
            row = rows[i]
            indices = row.get("indices", [])
            values = row.get("values", [])
            for j, idx in enumerate(indices):
                if idx == gene_idx:
                    expr = values[j]
                    break

        # Spatial coordinates
        sx, sy = 0.0, 0.0
        if spatial and i < len(spatial):
            sx = spatial[i][0] if len(spatial[i]) > 0 else 0
            sy = spatial[i][1] if len(spatial[i]) > 1 else 0

        # UMAP coordinates
        ux, uy = 0.0, 0.0
        if umap_points and i < len(umap_points):
            ux = umap_points[i][0] if len(umap_points[i]) > 0 else 0
            uy = umap_points[i][1] if len(umap_points[i]) > 1 else 0

        # Filter by cluster
        if request.selectedCluster and cell.get("clusterLabel") != request.selectedCluster:
            continue

        points.append({
            "id": cell["cellId"],
            "clusterId": hash(cell.get("clusterLabel", "")) % 20,
            "clusterLabel": cell.get("clusterLabel", "Unknown"),
            "cellType": cell.get("cellType", "Unknown"),
            "x": sx,
            "y": sy,
            "umapX": ux,
            "umapY": uy,
            "expression": expr,
            "pseudotime": cell.get("pseudotime", 0),
            "selected": cell["cellId"] == request.selectedCellId,
        })

    # Build hotspots from Moran's I
    hotspots = []
    for item in analysis.get("moranI", [])[:50]:
        if item.get("pval_adj", 1) < 0.05:
            hotspots.append({
                "geneSymbol": item["gene"],
                "moranI": item.get("I", 0),
                "pvalAdj": item.get("pval_adj", 1),
                "spatialPattern": "clustered" if (item.get("I", 0) or 0) > 0.1 else "random",
            })

    # Build cluster summaries
    cluster_summaries = []
    marker_genes = analysis.get("markerGenes", {})
    for cluster in cluster_labels:
        cells_in_cluster = [c for c in obs if c.get("clusterLabel") == cluster]
        top_genes = marker_genes.get(cluster, [])[:5]
        cluster_summaries.append({
            "clusterId": hash(cluster) % 20,
            "clusterLabel": cluster,
            "cellCount": len(cells_in_cluster),
            "meanExpression": 0,  # Computed on demand
            "fate": "unknown",
            "topGenes": [g["gene"] for g in top_genes],
        })

    # Build trajectory from PAGA
    paga = analysis.get("paga", {})
    trajectory_nodes = []
    trajectory_edges = []
    if paga and paga.get("connectivities"):
        conn = paga["connectivities"]
        for i, cluster in enumerate(cluster_labels):
            trajectory_nodes.append({
                "clusterId": i,
                "clusterLabel": cluster,
                "x": 0.2 + (i % 4) * 0.2,
                "y": 0.3 + (i // 4) * 0.3,
                "cellCount": sum(1 for c in obs if c.get("clusterLabel") == cluster),
            })
        if isinstance(conn, list):
            for i, row in enumerate(conn):
                for j, val in enumerate(row):
                    if i < j and isinstance(val, (int, float)) and val > 0.15:
                        trajectory_edges.append({
                            "from": i,
                            "to": j,
                            "weight": float(val),
                        })

    # Coexpression
    coexpression = []
    moran_list = analysis.get("moranI", [])
    for item in moran_list[:20]:
        if item.get("gene") != selected_gene:
            coexpression.append({
                "geneSymbol": item["gene"],
                "correlation": (item.get("I", 0) or 0),
            })

    return {
        "artifactId": artifact["artifactId"],
        "validity": "real" if metadata.get("hasSpatialCoords") else "partial",
        "datasetMeta": {
            "availableViews": metadata.get("availableViews", {}),
            "cellCount": len(obs),
            "geneCount": len(var),
            "sampleCount": 1,
            "fileName": artifact.get("source", {}).get("fileName", ""),
            "missingFields": metadata.get("missingFields", []),
            "parserVersion": artifact.get("source", {}).get("parserVersion", ""),
            "sampleMetadataKeys": metadata.get("extractedKeys", {}).get("sampleMetadataKeys", []),
            "warnings": metadata.get("warnings", []),
        },
        "availableGenes": gene_symbols,
        "availableClusters": cluster_labels,
        "selection": {
            "selectedGene": selected_gene,
            "selectedCluster": request.selectedCluster,
            "selectedCellId": request.selectedCellId,
            "viewMode": request.viewMode,
        },
        "centerView": {
            "points": points,
            "xLabel": "spatial_1",
            "yLabel": "spatial_2",
            "trajectory": {
                "nodes": trajectory_nodes,
                "edges": trajectory_edges,
            },
        },
        "rightPanel": {
            "clusterSummaries": cluster_summaries,
            "hotspots": hotspots,
            "coexpression": coexpression,
            "selectedClusterSummary": next(
                (cs for cs in cluster_summaries if cs["clusterLabel"] == request.selectedCluster),
                None,
            ),
            "provenance": {
                "source": "scanpy-squidpy",
                "engine": "Python backend",
            },
        },
        "exportData": {
            "clusterAnnotations": obs,
            "hotspotTable": hotspots,
        },
        "analysis": {
            "moranI": analysis.get("moranI", []),
            "markerGenes": analysis.get("markerGenes", {}),
            "nhoodEnrichment": analysis.get("nhoodEnrichment"),
            "ligrec": analysis.get("ligrec"),
            "paga": analysis.get("paga"),
        },
    }


# ── MOFA+ multi-omics factor analysis ──────────────────────────────

@app.post("/mofa")
async def mofa_endpoint(request: Request):
    """Run MOFA+ multi-omics factor analysis."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    views_data = body.get("views", {})
    n_factors = body.get("nFactors", 10)
    n_iterations = body.get("nIterations", 1000)
    convergence_mode = body.get("convergenceMode", "medium")

    if not views_data:
        raise HTTPException(400, "At least one view is required")

    # Convert to numpy arrays
    views = {}
    feature_names = {}
    sample_names = []

    for view_name, view_data in views_data.items():
        data = np.array(view_data.get("data", []))
        if data.size == 0:
            continue
        views[view_name] = data
        feature_names[view_name] = view_data.get("features", [f"f{j}" for j in range(data.shape[1])])
        if not sample_names:
            sample_names = view_data.get("samples", [f"sample_{i}" for i in range(data.shape[0])])

    if not views:
        raise HTTPException(400, "No valid view data provided")

    try:
        result = run_mofa_analysis(
            views=views,
            sample_names=sample_names,
            feature_names=feature_names,
            n_factors=n_factors,
            n_iterations=n_iterations,
            convergence_mode=convergence_mode,
        )
        return {"ok": True, **result}
    except Exception as e:
        logger.exception("MOFA+ analysis failed")
        raise HTTPException(500, f"MOFA+ analysis failed: {str(e)}")


# ── Demo mode: create artifact without Python analysis ──────────────

@app.post("/demo")
async def demo():
    """Create a demo artifact using real Visium mouse brain data."""
    import squidpy as sq

    artifact_id = f"scspatial-demo-{uuid.uuid4().hex[:12]}"
    uploaded_at = int(time.time() * 1000)

    try:
        # Load real Visium mouse brain dataset
        adata = sq.datasets.visium_hne_adata()
    except Exception as e:
        logger.warning(f"Failed to load real Visium data: {e}, falling back to synthetic")
        return _create_synthetic_demo(artifact_id, uploaded_at)

    # Run the full scanpy pipeline on real data
    config = AnalysisConfig()
    on_progress = lambda p, s, m: logger.info(f"[demo] {p:.0%} | {s} | {m}")
    adata = run_full_pipeline(adata, config, on_progress)

    # Build artifact
    artifact = build_artifact(adata, artifact_id, "visium_hne_demo.h5ad", uploaded_at)
    artifacts[artifact_id] = artifact

    return {
        "ok": True,
        "artifactId": artifact_id,
        "status": "completed",
    }


def _create_synthetic_demo(artifact_id: str, uploaded_at: int) -> Dict[str, Any]:
    """Create a synthetic spatial transcriptomics demo artifact as fallback."""
    import random

    # Generate realistic synthetic spatial transcriptomics data
    # Simulates a tissue section with spatially coherent clusters
    import math

    n_cells = 500
    n_genes = 50
    gene_names = [
        "EPCAM", "KRT19", "CDH1", "VIM", "CDH2", "FN1", "COL1A1", "COL3A1",
        "CD3D", "CD3E", "CD4", "CD8A", "MS4A1", "CD79A", "CD68", "CD163",
        "PECAM1", "VWF", "ACTA2", "TAGLN", "PDGFRA", "PDGFRB", "DCN", "LUM",
        "TP53", "EGFR", "ERBB2", "MYC", "KRAS", "BRAF", "PTEN", "PIK3CA",
        "SOX2", "NES", "NOTCH1", "ATP5F1", "COX4I1", "SDHB", "IDH1",
        "HSPA5", "DDIT3", "ATF4", "XBP1", "MKI67", "PCNA", "TOP2A", "CCNB1",
        "GAPDH", "ACTB", "CDH17",
    ][:n_genes]

    # Cluster centers (x, y) — simulating tissue regions
    cluster_defs = [
        ("Epithelial",  50, 50, 18),   # center gland/tumor
        ("Stromal",     50, 50, 35),   # surrounding stroma (ring)
        ("Immune",      30, 70, 12),   # immune infiltrate
        ("Immune",      75, 30, 10),   # secondary immune cluster
        ("Endothelial", 20, 40,  8),   # blood vessel region
        ("Endothelial", 80, 60,  8),   # second vessel
    ]

    # Marker genes per cluster (high expression)
    markers = {
        "Epithelial":  ["EPCAM", "KRT19", "CDH1", "EGFR", "ERBB2"],
        "Stromal":     ["VIM", "FN1", "COL1A1", "COL3A1", "DCN", "LUM", "PDGFRA"],
        "Immune":      ["CD3D", "CD3E", "CD4", "CD8A", "MS4A1", "CD79A", "CD68"],
        "Endothelial": ["PECAM1", "VWF", "ACTA2", "TAGLN", "CDH2"],
    }

    cells = []
    spatial = []
    cell_idx = 0

    for cluster_name, cx, cy, radius in cluster_defs:
        # Cells per cluster proportional to area
        n_in_cluster = int(n_cells * (radius * radius) / sum(r * r for _, _, _, r in cluster_defs))
        for _ in range(n_in_cluster):
            # Gaussian scatter around cluster center
            x = cx + random.gauss(0, radius * 0.6)
            y = cy + random.gauss(0, radius * 0.6)
            cells.append({
                "cellId": f"cell-{cell_idx:04d}",
                "clusterLabel": cluster_name,
                "cellType": cluster_name,
            })
            spatial.append([round(x, 2), round(y, 2)])
            cell_idx += 1

    # Fill remaining cells as scattered background
    while cell_idx < n_cells:
        x = random.uniform(5, 95)
        y = random.uniform(5, 95)
        cells.append({
            "cellId": f"cell-{cell_idx:04d}",
            "clusterLabel": "Stromal",
            "cellType": "Stromal",
        })
        spatial.append([round(x, 2), round(y, 2)])
        cell_idx += 1

    # Build expression matrix — marker genes have high expression in their cluster
    marker_set = set()
    for genes in markers.values():
        marker_set.update(genes)

    rows = []
    for i, cell in enumerate(cells):
        cluster = cell["clusterLabel"]
        cluster_markers = markers.get(cluster, [])
        indices = []
        values = []
        for j, gene in enumerate(gene_names):
            if gene in cluster_markers:
                # High expression for marker genes (2.0 - 6.0)
                val = round(random.uniform(2.0, 6.0), 3)
            elif gene in marker_set:
                # Low expression for other clusters' markers (0 - 0.5)
                val = round(random.uniform(0, 0.5), 3) if random.random() > 0.5 else 0
            else:
                # Background genes: sparse, low expression
                if random.random() > 0.7:
                    val = round(random.uniform(0.1, 2.0), 3)
                else:
                    val = 0
            if val > 0:
                indices.append(j)
                values.append(val)
        rows.append({"indices": indices, "values": values})

    artifact = {
        "schemaVersion": 1,
        "artifactId": artifact_id,
        "source": {
            "fileName": "bundled-demo.h5ad",
            "uploadedAt": uploaded_at,
            "sampleCount": 1,
            "parserVersion": "scspatial-scanpy-demo/1.0.0",
            "pythonVersion": None,
        },
        "matrix": {
            "X": {
                "encoding": "row-sparse-v1",
                "nObs": n_cells,
                "nVars": n_genes,
                "rows": rows,
            },
            "layers": {},
            "defaultLayer": "X",
        },
        "obs": cells,
        "var": [{"geneId": g, "geneSymbol": g} for g in gene_names],
        "obsm": {
            "spatial": spatial,
            "embeddings": {},
        },
        "metadata": {
            "warnings": ["Bundled demo dataset."],
            "missingFields": [],
            "availableViews": {
                "spatial2d": True,
                "spatial3d": True,
                "umap": False,
                "trajectory": True,
                "table": True,
            },
            "extractedKeys": {
                "layers": [],
                "embeddings": [],
                "clusterLabelKey": "cellType",
                "cellTypeKey": "cellType",
                "batchKey": None,
                "sampleMetadataKeys": [],
            },
            "hasSpatialCoords": True,
            "hasClusterLabels": True,
            "hasPrecomputedUmap": False,
        },
        "analysis": {
            "moranI": [
                {"gene": g, "I": round(random.uniform(0.3, 0.85), 3), "pval": round(random.uniform(0.0001, 0.01), 4), "pval_adj": round(random.uniform(0.001, 0.05), 4)}
                for g in gene_names[:20]
            ],
            "markerGenes": {
                cluster_name: [{"gene": m, "logFC": round(random.uniform(2, 5), 2), "pval_adj": round(random.uniform(0.0001, 0.001), 4), "score": round(random.uniform(10, 25), 2)} for m in markers_list[:5]]
                for cluster_name, markers_list in markers.items()
            },
            "paga": None,
            "nhoodEnrichment": None,
            "ligrec": None,
        },
    }

    artifacts[artifact_id] = artifact

    return {
        "ok": True,
        "artifactId": artifact_id,
        "status": "completed",
    }


def _find_visium_root(directory: str) -> Optional[str]:
    """Walk a directory tree to find the root of a Space Ranger output.

    Looks for a directory containing both `spatial/` and
    `filtered_feature_bc_matrix/` (or `raw_feature_bc_matrix/`).
    """
    for root, dirs, _files in os.walk(directory):
        has_spatial = "spatial" in dirs
        has_matrix = "filtered_feature_bc_matrix" in dirs or "raw_feature_bc_matrix" in dirs
        if has_spatial and has_matrix:
            return root
    return None


# ── Entrypoint ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
