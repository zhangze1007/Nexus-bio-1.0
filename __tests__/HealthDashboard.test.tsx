/**
 * Tests for src/components/admin/HealthDashboard.tsx
 *
 * Covers:
 * - Loading state rendering
 * - Error state rendering with retry
 * - Healthy status display for all services
 * - Degraded and down status indicators
 * - Detail/error messages shown when present
 * - Manual refresh button
 * - Auto-refresh interval setup
 * - Stale error banner when refresh fails but previous data exists
 */

import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import HealthDashboard from "../src/components/admin/HealthDashboard";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

// Silence act() warnings from setInterval
beforeEach(() => {
  jest.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

function healthyResponse() {
  return {
    ok: true,
    status: "healthy",
    timestamp: "2026-06-26T12:00:00.000Z",
    checks: [
      { name: "Database", status: "healthy", latencyMs: 12, lastChecked: "2026-06-26T12:00:00.000Z" },
      { name: "Groq", status: "healthy", latencyMs: 85, lastChecked: "2026-06-26T12:00:00.000Z" },
      { name: "Gemini", status: "healthy", latencyMs: 120, lastChecked: "2026-06-26T12:00:00.000Z" },
      { name: "Redis", status: "healthy", latencyMs: 5, lastChecked: "2026-06-26T12:00:00.000Z" },
      { name: "R2 Storage", status: "healthy", latencyMs: 30, lastChecked: "2026-06-26T12:00:00.000Z" },
      { name: "WebSocket", status: "healthy", latencyMs: 8, lastChecked: "2026-06-26T12:00:00.000Z" },
    ],
  };
}

function mixedResponse() {
  return {
    ok: true,
    status: "degraded",
    timestamp: "2026-06-26T12:00:00.000Z",
    checks: [
      { name: "Database", status: "healthy", latencyMs: 12, lastChecked: "2026-06-26T12:00:00.000Z" },
      { name: "Groq", status: "degraded", latencyMs: 3200, lastChecked: "2026-06-26T12:00:00.000Z", detail: "HTTP 429" },
      { name: "Gemini", status: "down", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z", detail: "GEMINI_API_KEY not configured" },
      { name: "Redis", status: "down", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z", detail: "No Redis URL configured" },
      { name: "R2 Storage", status: "down", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z", detail: "R2 credentials not configured" },
      { name: "WebSocket", status: "down", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z", detail: "WebSocket URL not configured" },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("HealthDashboard", () => {
  it("renders loading state initially", () => {
    // fetch never resolves during this test
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<HealthDashboard />);
    expect(screen.getByTestId("health-loading")).toBeTruthy();
    expect(screen.getByText("Loading health status...")).toBeTruthy();
  });

  it("renders error state when fetch fails and no cached data", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network down"));
    await act(async () => {
      render(<HealthDashboard />);
    });
    expect(screen.getByTestId("health-error")).toBeTruthy();
    expect(screen.getByText("Health check failed")).toBeTruthy();
    expect(screen.getByText("Network down")).toBeTruthy();
    expect(screen.getByTestId("retry-button")).toBeTruthy();
  });

  it("renders all six service cards when fetch succeeds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => healthyResponse(),
    });
    await act(async () => {
      render(<HealthDashboard />);
    });
    expect(screen.getByTestId("health-dashboard")).toBeTruthy();
    expect(screen.getByText("Database")).toBeTruthy();
    expect(screen.getByText("Groq")).toBeTruthy();
    expect(screen.getByText("Gemini")).toBeTruthy();
    expect(screen.getByText("Redis")).toBeTruthy();
    expect(screen.getByText("R2 Storage")).toBeTruthy();
    expect(screen.getByText("WebSocket")).toBeTruthy();
  });

  it("displays correct latency values", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => healthyResponse(),
    });
    await act(async () => {
      render(<HealthDashboard />);
    });
    expect(screen.getByText("12 ms")).toBeTruthy();
    expect(screen.getByText("85 ms")).toBeTruthy();
    expect(screen.getByText("5 ms")).toBeTruthy();
  });

  it("shows degraded and down status badges with detail messages", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mixedResponse(),
    });
    await act(async () => {
      render(<HealthDashboard />);
    });
    // Overall status badge should say DEGRADED (worst-case)
    const badge = screen.getByTestId("overall-status-badge");
    expect(badge.textContent).toBe("Degraded");

    // Degraded Groq card
    expect(screen.getByTestId("check-card-groq")).toBeTruthy();
    expect(screen.getByTestId("status-dot-degraded")).toBeTruthy();

    // Down Gemini card
    expect(screen.getByTestId("check-card-gemini")).toBeTruthy();
    const downDots = screen.getAllByTestId("status-dot-down");
    expect(downDots.length).toBeGreaterThanOrEqual(1);

    // Detail messages rendered
    expect(screen.getByText("HTTP 429")).toBeTruthy();
    expect(screen.getByText("GEMINI_API_KEY not configured")).toBeTruthy();
  });

  it("shows healthy overall badge when all services are healthy", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => healthyResponse(),
    });
    await act(async () => {
      render(<HealthDashboard />);
    });
    const badge = screen.getByTestId("overall-status-badge");
    expect(badge.textContent).toBe("Healthy");
  });

  it("manual refresh button triggers a new fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => healthyResponse(),
    });
    await act(async () => {
      render(<HealthDashboard />);
    });
    // Initial fetch called once
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const btn = screen.getByTestId("manual-refresh");
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retry button in error state triggers a new fetch", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    await act(async () => {
      render(<HealthDashboard />);
    });
    expect(screen.getByTestId("retry-button")).toBeTruthy();

    // Now make the retry succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => healthyResponse(),
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-button"));
    });
    // Should now show the dashboard
    expect(screen.getByTestId("health-dashboard")).toBeTruthy();
    expect(screen.getByText("Database")).toBeTruthy();
  });

  it("auto-refreshes every 30 seconds", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => healthyResponse(),
    });
    await act(async () => {
      render(<HealthDashboard />);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance 30 seconds
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Advance another 30 seconds
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("shows stale error banner when refresh fails but data exists", async () => {
    // First call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => healthyResponse(),
    });
    await act(async () => {
      render(<HealthDashboard />);
    });
    expect(screen.getByTestId("health-dashboard")).toBeTruthy();

    // Second call (auto-refresh) fails
    mockFetch.mockRejectedValueOnce(new Error("temporary outage"));
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    // Dashboard still visible with cached data
    expect(screen.getByTestId("health-dashboard")).toBeTruthy();
    expect(screen.getByText("Database")).toBeTruthy();

    // Stale error banner appears
    expect(screen.getByTestId("stale-error")).toBeTruthy();
    expect(screen.getByText(/temporary outage/)).toBeTruthy();
  });

  it("renders the auto-refresh interval notice", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => healthyResponse(),
    });
    await act(async () => {
      render(<HealthDashboard />);
    });
    expect(screen.getByText("Auto-refreshes every 30s")).toBeTruthy();
  });

  it("formats sub-millisecond latency as <1 ms", async () => {
    const response = {
      ok: true,
      status: "healthy",
      timestamp: "2026-06-26T12:00:00.000Z",
      checks: [
        { name: "Database", status: "healthy", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "Groq", status: "healthy", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "Gemini", status: "healthy", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "Redis", status: "healthy", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "R2 Storage", status: "healthy", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "WebSocket", status: "healthy", latencyMs: 0, lastChecked: "2026-06-26T12:00:00.000Z" },
      ],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => response });
    await act(async () => {
      render(<HealthDashboard />);
    });
    const subMsElements = screen.getAllByText("<1 ms");
    expect(subMsElements.length).toBeGreaterThanOrEqual(1);
  });

  it("formats second-range latency correctly", async () => {
    const response = {
      ok: true,
      status: "degraded",
      timestamp: "2026-06-26T12:00:00.000Z",
      checks: [
        { name: "Database", status: "healthy", latencyMs: 12, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "Groq", status: "degraded", latencyMs: 3200, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "Gemini", status: "healthy", latencyMs: 120, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "Redis", status: "healthy", latencyMs: 5, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "R2 Storage", status: "healthy", latencyMs: 30, lastChecked: "2026-06-26T12:00:00.000Z" },
        { name: "WebSocket", status: "healthy", latencyMs: 8, lastChecked: "2026-06-26T12:00:00.000Z" },
      ],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => response });
    await act(async () => {
      render(<HealthDashboard />);
    });
    expect(screen.getByText("3.2 s")).toBeTruthy();
  });
});
