"""Tests for the NexusBioClient using mocked HTTP responses."""

from __future__ import annotations

import pytest
import httpx

from nexus_bio import NexusBioClient
from nexus_bio.exceptions import (
    AuthenticationError,
    RateLimitError,
    ServerError,
    ValidationError,
)


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def client() -> NexusBioClient:
    return NexusBioClient(api_key="test-key", base_url="https://test.nexus-bio.local")


# ── Health ───────────────────────────────────────────────────────────────────

def test_health(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/health",
        json={"status": "ok", "timestamp": "2026-06-26T00:00:00Z", "version": "abc1234"},
    )
    result = client.health()
    assert result.status == "ok"
    assert result.version == "abc1234"


# ── Analyze ──────────────────────────────────────────────────────────────────

def test_analyze_basic(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/analyze",
        json={
            "candidates": [
                {"content": {"parts": [{"text": "Artemisinin pathway analysis complete."}]}}
            ],
            "meta": {"provider": "groq"},
        },
    )
    result = client.analyze("Design an artemisinin pathway")
    assert result.text == "Artemisinin pathway analysis complete."
    assert result.meta.provider == "groq"


def test_analyze_with_context(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/analyze",
        json={
            "candidates": [{"content": {"parts": [{"text": "Context-aware response."}]}}],
            "meta": {"provider": "gemini"},
        },
    )
    result = client.analyze("Optimize yield", context={"organism": "S. cerevisiae"})
    assert result.text == "Context-aware response."


def test_analyze_no_candidates(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/analyze",
        json={"candidates": [], "meta": {"provider": "none"}},
    )
    result = client.analyze("test")
    assert result.text is None


# ── FBA ──────────────────────────────────────────────────────────────────────

def test_run_fba_single(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/fba",
        json={
            "ok": True,
            "growthRate": 0.873,
            "fluxes": {"BIOMASS_Ecoli_core": 0.873, "EX_glc__D_e": -10.0},
            "objectiveValue": 0.873,
            "status": "optimal",
        },
    )
    result = client.run_fba(objective="biomass", species="ecoli")
    assert result.ok is True
    assert result.growth_rate == pytest.approx(0.873)
    assert result.fluxes["BIOMASS_Ecoli_core"] == pytest.approx(0.873)


def test_run_fba_community(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/fba",
        json={
            "ok": True,
            "growthRate": 0.5,
            "fluxes": {},
            "status": "optimal",
        },
    )
    result = client.run_fba(mode="community", alpha=0.6)
    assert result.ok is True


def test_run_fba_with_knockouts(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/fba",
        json={
            "ok": True,
            "growthRate": 0.71,
            "fluxes": {},
            "status": "optimal",
        },
    )
    result = client.run_fba(knockouts=["PFK", "PGK"])
    assert result.growth_rate == pytest.approx(0.71)


# ── Inventory ────────────────────────────────────────────────────────────────

def test_list_inventory(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/inventory/strains",
        json={
            "items": [
                {"id": "inv_1", "name": "E. coli BL21", "species": "E. coli"},
                {"id": "inv_2", "name": "S. cerevisiae BY4741", "species": "S. cerevisiae"},
            ],
            "total": 2,
        },
    )
    result = client.list_inventory("strains")
    assert result.total == 2
    assert result.items[0].name == "E. coli BL21"


def test_list_inventory_with_search(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/inventory/plasmids",
        json={"items": [{"id": "inv_3", "name": "pET28a"}], "total": 1},
    )
    result = client.list_inventory("plasmids", search="pET")
    assert result.total == 1


def test_create_inventory_item(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/inventory/chemicals",
        json={"id": "inv_new", "name": "IPTG", "cas_number": "367-93-1"},
    )
    result = client.create_inventory_item("chemicals", {"name": "IPTG", "cas_number": "367-93-1"})
    assert result["name"] == "IPTG"


# ── Projects ─────────────────────────────────────────────────────────────────

def test_list_projects(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/workbench",
        json=[
            {"id": "proj_1", "name": "Artemisinin", "revision": 5},
            {"id": "proj_2", "name": "Lycopene", "revision": 2},
        ],
    )
    result = client.list_projects()
    assert len(result) == 2
    assert result[0].name == "Artemisinin"


# ── External lookups ─────────────────────────────────────────────────────────

def test_analyze_protein(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/alphafold?id=Q9AR04",
        json={"pdb": "HEADER ..."},
    )
    result = client.analyze_protein("Q9AR04")
    assert "pdb" in result


def test_lookup_molecule(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/pubchem?name=artemisinin",
        json={"sdf": "..."},
    )
    result = client.lookup_molecule(name="artemisinin")
    assert "sdf" in result


def test_search_kegg(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/kegg?q=mevalonate",
        json={"results": []},
    )
    result = client.search_kegg("mevalonate")
    assert "results" in result


# ── Error handling ───────────────────────────────────────────────────────────

def test_auth_error(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/health",
        status_code=401,
        json={"error": "Invalid API key"},
    )
    with pytest.raises(AuthenticationError, match="Invalid API key"):
        client.health()


def test_rate_limit_error(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/analyze",
        status_code=429,
        json={"error": "Rate limit exceeded"},
        headers={"Retry-After": "60"},
    )
    with pytest.raises(RateLimitError) as exc_info:
        client.analyze("test")
    assert exc_info.value.retry_after == 60


def test_validation_error(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/analyze",
        status_code=400,
        json={"error": "Invalid JSON body"},
    )
    with pytest.raises(ValidationError, match="Invalid JSON body"):
        client.analyze("test")


def test_server_error(client: NexusBioClient, httpx_mock):
    httpx_mock.add_response(
        url="https://test.nexus-bio.local/api/health",
        status_code=500,
        json={"error": "Internal server error"},
    )
    with pytest.raises(ServerError):
        client.health()


# ── Context manager ──────────────────────────────────────────────────────────

def test_context_manager():
    with NexusBioClient(api_key="key", base_url="https://test.local") as c:
        assert c.api_key == "key"
