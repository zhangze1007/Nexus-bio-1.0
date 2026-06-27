/**
 * SessionManager tests.
 *
 * Covers: render, fetch, session display, current badge, revoke button
 * visibility, DELETE revoke flow, error handling, empty state, refresh,
 * device/IP info rendering, and custom headers.
 */

// Mock framer-motion to avoid animation timing issues in jsdom
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    __esModule: true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy(
      {},
      {
        get: (_target: unknown, prop: string) => {
          const MotionComponent = React.forwardRef(
            (
              { children, ...props }: Record<string, unknown>,
              ref: React.Ref<HTMLElement>,
            ) => {
              // Filter out framer-motion specific props that would cause DOM warnings
              const filtered: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(props)) {
                if (
                  !k.startsWith("while") &&
                  k !== "variants" &&
                  k !== "initial" &&
                  k !== "animate" &&
                  k !== "exit" &&
                  k !== "transition" &&
                  k !== "layout"
                ) {
                  filtered[k] = v;
                }
              }
              return React.createElement(prop, { ...filtered, ref }, children);
            },
          );
          MotionComponent.displayName = `motion.${prop}`;
          return MotionComponent;
        },
      },
    ),
  };
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import SessionManager from "../src/components/auth/SessionManager";
import type { Session } from "../src/components/auth/SessionManager";

// ── Mock data ──────────────────────────────────────────────────────────────

function makeSessions(): Session[] {
  const now = Date.now();
  return [
    {
      id: "sess-current",
      device: "Desktop — Chrome 126",
      browser: "Chrome 126",
      os: "Windows 11",
      ip: "192.168.1.42",
      lastActive: now,
      createdAt: now - 86_400_000,
      isCurrent: true,
    },
    {
      id: "sess-other",
      device: "MacBook Pro — Safari 18",
      browser: "Safari 18",
      os: "macOS Sequoia",
      ip: "10.0.0.17",
      lastActive: now - 3_600_000,
      createdAt: now - 86_400_000 * 12,
      isCurrent: false,
    },
    {
      id: "sess-mobile",
      device: "iPhone 16 — Safari Mobile",
      browser: "Safari Mobile",
      os: "iOS 19",
      ip: "172.16.0.88",
      lastActive: now - 86_400_000,
      createdAt: now - 86_400_000 * 30,
      isCurrent: false,
    },
  ];
}

// ── Global fetch mock ──────────────────────────────────────────────────────

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SessionManager", () => {
  it("renders the component shell with heading", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [] }),
    });
    render(<SessionManager />);
    expect(screen.getByTestId("session-manager")).toBeTruthy();
    expect(screen.getByText("Active Sessions")).toBeTruthy();
  });

  it("fetches sessions on mount via GET", async () => {
    const sessions = makeSessions();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions }),
    });
    render(<SessionManager />);

    await waitFor(() => {
      expect(screen.getByText("Desktop — Chrome 126")).toBeTruthy();
    });
    expect(screen.getByText("MacBook Pro — Safari 18")).toBeTruthy();
    expect(screen.getByText("iPhone 16 — Safari Mobile")).toBeTruthy();
    // fetch is called at least once (React StrictMode may call effect twice)
    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/sessions", {
      headers: {},
    });
  });

  it("shows current badge on the current session", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: makeSessions() }),
    });
    render(<SessionManager />);

    await waitFor(() => {
      expect(screen.getByTestId("current-badge")).toBeTruthy();
    });
    expect(screen.getByText("Current")).toBeTruthy();
  });

  it("shows revoke button only for non-current sessions", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: makeSessions() }),
    });
    render(<SessionManager />);

    await waitFor(() => {
      expect(screen.getByText("Desktop — Chrome 126")).toBeTruthy();
    });

    // Non-current sessions have revoke buttons
    expect(screen.getByTestId("revoke-btn-sess-other")).toBeTruthy();
    expect(screen.getByTestId("revoke-btn-sess-mobile")).toBeTruthy();

    // Current session should NOT have a revoke button
    expect(screen.queryByTestId("revoke-btn-sess-current")).toBeNull();
  });

  it("calls DELETE with sessionId when revoke button is clicked", async () => {
    const sessions = makeSessions();
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({ sessions }),
      };
    });

    render(<SessionManager />);

    await waitFor(() => {
      expect(screen.getByTestId("revoke-btn-sess-other")).toBeTruthy();
    });

    const callCountBefore = mockFetch.mock.calls.length;

    fireEvent.click(screen.getByTestId("revoke-btn-sess-other"));

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callCountBefore);
    });

    // Find the DELETE call
    const deleteCall = mockFetch.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>)?.method === "DELETE",
    );
    expect(deleteCall).toBeTruthy();
    expect(deleteCall![0]).toBe("/api/auth/sessions");
    expect(JSON.parse((deleteCall![1] as Record<string, unknown>).body as string)).toEqual({
      sessionId: "sess-other",
    });
  });

  it("displays an error banner when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    });
    render(<SessionManager />);

    await waitFor(() => {
      expect(screen.getByTestId("session-error")).toBeTruthy();
    });
    expect(screen.getByText(/Failed to load sessions/)).toBeTruthy();
  });

  it("displays an error banner when revoke fails", async () => {
    // Use mockImplementation to differentiate GET vs DELETE requests.
    // React StrictMode double-invokes effects, so we may get extra GETs.
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const isDelete = init?.method === "DELETE";
      if (isDelete) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: "Cannot revoke the current session",
          }),
        };
      }
      // All GET calls succeed
      return {
        ok: true,
        json: async () => ({ sessions: makeSessions() }),
      };
    });

    render(<SessionManager />);

    await waitFor(() => {
      expect(screen.getByTestId("revoke-btn-sess-other")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("revoke-btn-sess-other"));

    await waitFor(() => {
      expect(screen.getByTestId("session-error")).toBeTruthy();
    });
  });

  it("dismisses error banner when close button is clicked", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });
    render(<SessionManager />);

    await waitFor(() => {
      expect(screen.getByTestId("session-error")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Dismiss error"));

    await waitFor(() => {
      expect(screen.queryByTestId("session-error")).toBeNull();
    });
  });

  it("shows empty state when no sessions are returned", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [] }),
    });
    render(<SessionManager />);

    await waitFor(() => {
      expect(screen.getByTestId("session-empty")).toBeTruthy();
    });
    expect(screen.getByText("No active sessions found.")).toBeTruthy();
  });

  it("refresh button triggers a new fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: makeSessions() }),
    });
    render(<SessionManager />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("Desktop — Chrome 126")).toBeTruthy();
    });

    const callCountBeforeRefresh = mockFetch.mock.calls.length;

    fireEvent.click(screen.getByLabelText("Refresh sessions"));

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callCountBeforeRefresh);
    });
  });

  it("renders device info, IP, and relative time for each session", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: makeSessions() }),
    });
    render(<SessionManager />);

    await waitFor(() => {
      expect(screen.getByText("Desktop — Chrome 126")).toBeTruthy();
    });
    expect(screen.getByText("MacBook Pro — Safari 18")).toBeTruthy();
    expect(screen.getByText("iPhone 16 — Safari Mobile")).toBeTruthy();
    expect(screen.getByText("192.168.1.42")).toBeTruthy();
    expect(screen.getByText("10.0.0.17")).toBeTruthy();
    expect(screen.getByText("172.16.0.88")).toBeTruthy();

    // Relative time should be displayed
    expect(screen.getByText("Just now")).toBeTruthy();
  });

  it("passes custom headers to fetch calls", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [] }),
    });
    const customHeaders = { Authorization: "Bearer test-token" };
    render(<SessionManager headers={customHeaders} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // At least one call should include custom headers
    const callsWithAuth = mockFetch.mock.calls.filter(
      (call: unknown[]) =>
        (call[1] as Record<string, unknown>)?.headers === customHeaders,
    );
    expect(callsWithAuth.length).toBeGreaterThan(0);
  });
});
