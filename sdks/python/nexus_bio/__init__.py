"""Nexus-Bio Python SDK -- programmatic access to the Nexus-Bio synthetic biology platform."""

from .client import NexusBioClient
from .exceptions import (
    NexusBioError,
    AuthenticationError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from .models import (
    AnalyzeRequest,
    AnalyzeResponse,
    FBARequest,
    FBAResponse,
    InventoryItem,
    InventoryListResponse,
    ProjectSummary,
    HealthStatus,
)

__version__ = "0.1.0"

__all__ = [
    "NexusBioClient",
    "NexusBioError",
    "AuthenticationError",
    "RateLimitError",
    "ServerError",
    "ValidationError",
    "AnalyzeRequest",
    "AnalyzeResponse",
    "FBARequest",
    "FBAResponse",
    "InventoryItem",
    "InventoryListResponse",
    "ProjectSummary",
    "HealthStatus",
]
