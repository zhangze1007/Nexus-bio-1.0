"""Nexus-Bio Python SDK client.

Usage:
    from nexus_bio import NexusBioClient

    client = NexusBioClient(api_key="your-key")
    result = client.analyze("Design an artemisinin pathway")
    print(result.text)
"""

from __future__ import annotations

from typing import Any

import httpx

from .exceptions import (
    AuthenticationError,
    NexusBioError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from .models import (
    AnalyzeRequest,
    AnalyzeResponse,
    FBARequest,
    FBAResponse,
    HealthStatus,
    InventoryListResponse,
    ProjectSummary,
)

DEFAULT_BASE_URL = "https://nexus-bio-1-0.vercel.app"
DEFAULT_TIMEOUT = 30.0


class NexusBioClient:
    """Client for the Nexus-Bio REST API.

    Args:
        api_key: API key for authentication (sent as X-API-Key header).
        base_url: Base URL of the Nexus-Bio instance.
        timeout: Default request timeout in seconds.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={"X-API-Key": api_key},
            timeout=timeout,
        )

    # ── Public API methods ───────────────────────────────────────────────────

    def analyze(
        self,
        prompt: str,
        context: dict[str, Any] | None = None,
        history: list[dict[str, Any]] | None = None,
        search_query: str | None = None,
    ) -> AnalyzeResponse:
        """Send a research query to the AI assistant.

        Args:
            prompt: Research question or instruction.
            context: Optional context dictionary.
            history: Optional conversation history for multi-turn.
            search_query: Optional dynamic search query override.

        Returns:
            AnalyzeResponse with candidates and metadata.
        """
        payload: dict[str, Any] = {"prompt": prompt}
        if context is not None:
            payload["context"] = context
        if history is not None:
            payload["history"] = history
        if search_query is not None:
            payload["searchQuery"] = search_query

        raw = self._post("/api/analyze", payload)
        return AnalyzeResponse.model_validate(raw)

    def list_projects(self) -> list[ProjectSummary]:
        """List all workbench projects.

        Returns:
            List of ProjectSummary objects.
        """
        raw = self._get("/api/workbench")
        if isinstance(raw, list):
            return [ProjectSummary.model_validate(p) for p in raw]
        # Single project response
        return [ProjectSummary.model_validate(raw)]

    def get_project(self, project_id: str | None = None) -> ProjectSummary:
        """Get a specific project or the default project state.

        Args:
            project_id: Optional project ID header.

        Returns:
            ProjectSummary.
        """
        headers = {}
        if project_id:
            headers["x-workbench-project-id"] = project_id
        raw = self._get("/api/workbench", extra_headers=headers)
        return ProjectSummary.model_validate(raw)

    def run_fba(
        self,
        model: dict[str, Any] | None = None,
        objective: str = "biomass",
        species: str = "ecoli",
        mode: str = "single",
        action: str = "fba",
        glucose_uptake: float = 10.0,
        oxygen_uptake: float = 12.0,
        knockouts: list[str] | None = None,
        alpha: float = 0.5,
    ) -> FBAResponse:
        """Run a Flux Balance Analysis simulation.

        Args:
            model: Optional custom FBA model definition.
            objective: Optimization objective ('biomass', 'product', 'atp').
            species: Target organism ('ecoli', 'yeast').
            mode: Analysis mode ('single', 'community').
            action: Analysis action ('fba', 'fva', 'pfba', 'knockout', 'fseof', 'optknock').
            glucose_uptake: Glucose uptake rate (mmol/gDW/h).
            oxygen_uptake: Oxygen uptake rate (mmol/gDW/h).
            knockouts: List of reaction IDs to knock out.
            alpha: Community balance parameter (0-1, community mode only).

        Returns:
            FBAResponse with growth rate, fluxes, and shadow prices.
        """
        payload: dict[str, Any] = {
            "mode": mode,
            "species": species,
            "objective": objective,
            "action": action,
            "glucoseUptake": glucose_uptake,
            "oxygenUptake": oxygen_uptake,
            "knockouts": knockouts or [],
            "alpha": alpha,
        }
        if model is not None:
            payload["model"] = model

        raw = self._post("/api/fba", payload)
        return FBAResponse.model_validate(raw)

    def list_inventory(
        self,
        item_type: str,
        project_id: str | None = None,
        search: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> InventoryListResponse:
        """List inventory items of a given type.

        Args:
            item_type: One of 'strains', 'plasmids', 'primers', 'chemicals', 'locations'.
            project_id: Optional project filter.
            search: Optional search term.
            limit: Max items to return (default 200, max 500).
            offset: Pagination offset.

        Returns:
            InventoryListResponse with items and total count.
        """
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if project_id:
            params["projectId"] = project_id
        if search:
            params["search"] = search

        raw = self._get(f"/api/inventory/{item_type}", params=params)
        return InventoryListResponse.model_validate(raw)

    def create_inventory_item(self, item_type: str, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new inventory item.

        Args:
            item_type: One of 'strains', 'plasmids', 'primers', 'chemicals', 'locations'.
            data: Item fields (must include 'name').

        Returns:
            Created item dict.
        """
        return self._post(f"/api/inventory/{item_type}", data)

    def health(self) -> HealthStatus:
        """Check API health.

        Returns:
            HealthStatus with status, timestamp, and version.
        """
        raw = self._get("/api/health")
        return HealthStatus.model_validate(raw)

    def analyze_protein(self, uniprot_id: str) -> dict[str, Any]:
        """Fetch AlphaFold protein structure for a UniProt ID.

        Args:
            uniprot_id: UniProt accession (e.g. 'Q9AR04').

        Returns:
            PDB structure data.
        """
        return self._get("/api/alphafold", params={"id": uniprot_id})

    def lookup_molecule(self, name: str | None = None, cid: int | None = None) -> dict[str, Any]:
        """Look up a PubChem molecule by name or CID.

        Args:
            name: Compound name.
            cid: PubChem Compound ID.

        Returns:
            Molecule data (SDF format).
        """
        params: dict[str, Any] = {}
        if name:
            params["name"] = name
        if cid:
            params["cid"] = cid
        return self._get("/api/pubchem", params=params)

    def search_kegg(self, query: str) -> dict[str, Any]:
        """Search the KEGG pathway database.

        Args:
            query: Search term.

        Returns:
            KEGG search results.
        """
        return self._get("/api/kegg", params={"q": query})

    # ── Internal HTTP helpers ────────────────────────────────────────────────

    def _get(self, path: str, params: dict[str, Any] | None = None, extra_headers: dict[str, str] | None = None) -> Any:
        resp = self._client.get(path, params=params, headers=extra_headers)
        return self._handle_response(resp)

    def _post(self, path: str, data: dict[str, Any]) -> Any:
        resp = self._client.post(path, json=data)
        return self._handle_response(resp)

    @staticmethod
    def _handle_response(resp: httpx.Response) -> Any:
        if resp.is_success:
            return resp.json()

        status = resp.status_code
        try:
            body = resp.json()
        except Exception:
            body = {"error": resp.text}

        message = body.get("error", body.get("message", f"HTTP {status}"))

        if status in (401, 403):
            raise AuthenticationError(message, status_code=status, response_body=body)
        if status == 429:
            retry_after = resp.headers.get("Retry-After")
            raise RateLimitError(
                message,
                retry_after=int(retry_after) if retry_after else None,
                status_code=status,
                response_body=body,
            )
        if status in (400, 422):
            raise ValidationError(message, status_code=status, response_body=body)
        if status >= 500:
            raise ServerError(message, status_code=status, response_body=body)

        raise NexusBioError(message, status_code=status, response_body=body)

    # ── Context manager ──────────────────────────────────────────────────────

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> NexusBioClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
