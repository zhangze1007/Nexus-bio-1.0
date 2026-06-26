"""Custom exceptions for the Nexus-Bio Python SDK."""

from __future__ import annotations


class NexusBioError(Exception):
    """Base exception for all Nexus-Bio SDK errors."""

    def __init__(self, message: str, status_code: int | None = None, response_body: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class AuthenticationError(NexusBioError):
    """Raised when the API key is invalid or missing (401/403)."""


class RateLimitError(NexusBioError):
    """Raised when the rate limit is exceeded (429)."""

    def __init__(self, message: str, retry_after: int | None = None, **kwargs):
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class ServerError(NexusBioError):
    """Raised when the server returns a 5xx error."""


class ValidationError(NexusBioError):
    """Raised when the request payload is invalid (400/422)."""
