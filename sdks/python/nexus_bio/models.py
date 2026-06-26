"""Pydantic models for Nexus-Bio SDK request/response types."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Analyze ──────────────────────────────────────────────────────────────────

class ConversationTurn(BaseModel):
    """A single turn in a multi-turn conversation."""

    role: Literal["user", "model"] = "user"
    parts: list[dict[str, str]] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    """Request payload for the /api/analyze endpoint."""

    prompt: str = Field(..., max_length=10_000, description="Research query text")
    context: dict[str, Any] | None = Field(None, description="Optional context dict")
    history: list[ConversationTurn] | None = Field(None, description="Conversation history for multi-turn")
    search_query: str | None = Field(None, alias="searchQuery", description="Optional dynamic search query")


class AnalyzeResponseCandidateContent(BaseModel):
    parts: list[dict[str, str]] = Field(default_factory=list)


class AnalyzeResponseCandidate(BaseModel):
    content: AnalyzeResponseCandidateContent = Field(default_factory=AnalyzeResponseCandidateContent)


class AnalyzeResponseMeta(BaseModel):
    provider: str | None = None
    domain: dict[str, Any] | None = None
    parse_error: dict[str, Any] | None = Field(None, alias="parseError")


class AnalyzeResponse(BaseModel):
    """Response from the /api/analyze endpoint."""

    candidates: list[AnalyzeResponseCandidate] = Field(default_factory=list)
    meta: AnalyzeResponseMeta | None = None
    error: str | None = None

    @property
    def text(self) -> str | None:
        """Extract the first text part from the response, if any."""
        if self.candidates:
            parts = self.candidates[0].content.parts
            if parts:
                return parts[0].get("text")
        return None


# ── FBA ──────────────────────────────────────────────────────────────────────

class FBASpeciesConfig(BaseModel):
    """Per-species FBA configuration."""

    glucose_uptake: float = Field(10.0, alias="glucoseUptake")
    oxygen_uptake: float = Field(12.0, alias="oxygenUptake")
    knockouts: list[str] = Field(default_factory=list)


class FBARequest(BaseModel):
    """Request payload for the /api/fba endpoint."""

    mode: Literal["single", "community"] = "single"
    species: Literal["ecoli", "yeast"] = "ecoli"
    objective: Literal["biomass", "product", "atp"] = "biomass"
    action: Literal["fba", "fva", "pfba", "knockout", "fseof", "optknock"] = "fba"
    glucose_uptake: float = Field(10.0, alias="glucoseUptake")
    oxygen_uptake: float = Field(12.0, alias="oxygenUptake")
    knockouts: list[str] = Field(default_factory=list)
    alpha: float = Field(0.5, description="Community balance parameter (0-1)")
    ecoli: FBASpeciesConfig | None = None
    yeast: FBASpeciesConfig | None = None


class FBAResponse(BaseModel):
    """Response from the /api/fba endpoint."""

    ok: bool = True
    growth_rate: float | None = Field(None, alias="growthRate")
    fluxes: dict[str, float] = Field(default_factory=dict)
    shadow_prices: dict[str, float] = Field(None, alias="shadowPrices")
    objective_value: float | None = Field(None, alias="objectiveValue")
    status: str | None = None
    request_id: str | None = Field(None, alias="requestId")
    error: str | None = None


# ── Inventory ────────────────────────────────────────────────────────────────

class InventoryItem(BaseModel):
    """A single inventory item (strain, plasmid, primer, chemical, or location)."""

    id: str
    name: str
    project_id: str | None = Field(None, alias="projectId")
    created_at: str | None = Field(None, alias="createdAt")
    updated_at: str | None = Field(None, alias="updatedAt")
    notes: str | None = None
    model_config = {"extra": "allow"}


class InventoryListResponse(BaseModel):
    """Paginated inventory listing."""

    items: list[InventoryItem] = Field(default_factory=list)
    total: int = 0


# ── Workbench / Projects ─────────────────────────────────────────────────────

class ProjectSummary(BaseModel):
    """Summary of a workbench project."""

    id: str
    name: str | None = None
    revision: int | None = None
    updated_at: str | None = Field(None, alias="updatedAt")
    model_config = {"extra": "allow"}


# ── Health ───────────────────────────────────────────────────────────────────

class HealthStatus(BaseModel):
    """API health check response."""

    status: str = "ok"
    timestamp: str | None = None
    version: str | None = None
