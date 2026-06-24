"""Spatial Transcriptomics Backend — FastAPI service.

Runs the full scanpy/squidpy pipeline and serves results to the
Nexus-Bio Next.js frontend.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import anndata as ad
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from artifact_builder import build_artifact
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


# ── Demo mode: create artifact without Python analysis ──────────────

@app.post("/demo")
async def demo():
    """Create a demo artifact using bundled data (no file upload needed)."""
    import random

    artifact_id = f"scspatial-demo-{uuid.uuid4().hex[:12]}"
    uploaded_at = int(time.time() * 1000)

    # Generate synthetic spatial transcriptomics data
    n_cells = 200
    n_genes = 50
    gene_names = [
        "EPCAM", "KRT19", "CDH1", "VIM", "CDH2", "FN1", "COL1A1", "COL3A1",
        "CD3D", "CD3E", "CD4", "CD8A", "MS4A1", "CD79A", "CD68", "CD163",
        "PECAM1", "VWF", "ACTA2", "TAGLN", "PDGFRA", "PDGFRB", "DCN", "LUM",
        "TP53", "EGFR", "ERBB2", "MYC", "KRAS", "BRAF", "PTEN", "PIK3CA",
        "SOX2", "NES", "VIM", "NOTCH1", "ATP5F1", "COX4I1", "SDHB", "IDH1",
        "HSPA5", "DDIT3", "ATF4", "XBP1", "MKI67", "PCNA", "TOP2A", "CCNB1",
        "GAPDH", "ACTB",
    ][:n_genes]

    clusters = ["Epithelial", "Immune", "Stromal", "Endothelial"]
    cells = []
    for i in range(n_cells):
        cluster = clusters[i % len(clusters)]
        cells.append({
            "cellId": f"cell-{i:04d}",
            "clusterLabel": cluster,
            "cellType": cluster,
        })

    import math
    spatial = []
    for i in range(n_cells):
        angle = 2 * math.pi * i / n_cells
        r = 50 + random.gauss(0, 10)
        spatial.append([50 + r * math.cos(angle), 50 + r * math.sin(angle)])

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
                "rows": [
                    {"indices": [j for j in range(n_genes) if random.random() > 0.6],
                     "values": [round(random.uniform(0.1, 5.0), 3) for _ in range(sum(1 for j in range(n_genes) if random.random() > 0.6))]}
                    for _ in range(n_cells)
                ],
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
                {"gene": g, "I": round(random.uniform(-0.1, 0.8), 3), "pval": round(random.uniform(0, 0.05), 4), "pval_adj": round(random.uniform(0, 0.05), 4)}
                for g in gene_names[:20]
            ],
            "markerGenes": {
                cluster: [{"gene": gene_names[i * 5 + j], "logFC": round(random.uniform(1, 4), 2), "pval_adj": round(random.uniform(0, 0.01), 4), "score": round(random.uniform(5, 20), 2)} for j in range(5)]
                for i, cluster in enumerate(clusters)
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

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
