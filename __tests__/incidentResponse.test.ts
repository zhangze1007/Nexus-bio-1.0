/**
 * Incident Response — Unit Tests
 *
 * Tests: createIncident, updateIncident, listIncidents, generateIncidentReport
 */

import {
  createIncident,
  updateIncident,
  listIncidents,
  generateIncidentReport,
} from "../src/services/compliance/incidentResponse";
import { sqlRun, closeLibsqlClient } from "../src/server/libsqlDb";

afterAll(() => {
  closeLibsqlClient();
});

beforeEach(async () => {
  await sqlRun("DELETE FROM incidents").catch(() => {});
});

describe("incidentResponse", () => {
  // ── createIncident ──

  describe("createIncident", () => {
    test("creates an incident with valid inputs", async () => {
      const incident = await createIncident("high", "Database outage", ["db-primary", "db-replica"], "analyst-1");

      expect(incident.id).toBeDefined();
      expect(incident.id).toMatch(/[0-9a-f-]{36}/);
      expect(incident.severity).toBe("high");
      expect(incident.description).toBe("Database outage");
      expect(incident.affectedSystems).toEqual(["db-primary", "db-replica"]);
      expect(incident.status).toBe("open");
      expect(incident.detectedAt).toBeDefined();
      expect(incident.resolvedAt).toBeNull();
      expect(incident.rootCause).toBeNull();
      expect(incident.correctiveAction).toBeNull();
      expect(incident.createdBy).toBe("analyst-1");
    });

    test("defaults createdBy to 'system' when omitted", async () => {
      const incident = await createIncident("low", "Minor log warning", ["log-collector"]);
      expect(incident.createdBy).toBe("system");
    });

    test("rejects invalid severity", async () => {
      await expect(createIncident("urgent", "Bad severity", [])).rejects.toThrow(/Invalid severity/);
    });

    test("rejects empty description", async () => {
      await expect(createIncident("medium", "", [])).rejects.toThrow(/description must not be empty/);
    });
  });

  // ── updateIncident ──

  describe("updateIncident", () => {
    test("updates status", async () => {
      const incident = await createIncident("medium", "API latency spike", ["api-gateway"]);

      await updateIncident(incident.id, { status: "investigating" });

      const all = await listIncidents();
      const updated = all.find((i) => i.id === incident.id);
      expect(updated?.status).toBe("investigating");
    });

    test("auto-sets resolvedAt when status transitions to resolved", async () => {
      const incident = await createIncident("critical", "Data breach", ["auth-service"]);

      await updateIncident(incident.id, { status: "resolved" });

      const all = await listIncidents();
      const updated = all.find((i) => i.id === incident.id);
      expect(updated?.status).toBe("resolved");
      expect(updated?.resolvedAt).toBeDefined();
      expect(updated?.resolvedAt).not.toBeNull();
    });

    test("updates rootCause and correctiveAction", async () => {
      const incident = await createIncident("high", "Certificate expiry", ["cdn-edge"]);

      await updateIncident(incident.id, {
        rootCause: "Expired TLS certificate not auto-renewed",
        correctiveAction: "Enabled cert-manager auto-renewal with 30-day alert",
      });

      const report = await generateIncidentReport(incident.id);
      expect(report.incident.rootCause).toBe("Expired TLS certificate not auto-renewed");
      expect(report.incident.correctiveAction).toBe("Enabled cert-manager auto-renewal with 30-day alert");
    });

    test("throws when updating a nonexistent incident", async () => {
      await expect(updateIncident("nonexistent-id", { status: "resolved" })).rejects.toThrow(/not found/);
    });

    test("rejects invalid status value", async () => {
      const incident = await createIncident("low", "Test", []);
      await expect(updateIncident(incident.id, { status: "invalid-status" as any })).rejects.toThrow(
        /Invalid status/,
      );
    });
  });

  // ── listIncidents ──

  describe("listIncidents", () => {
    test("returns all incidents when no status filter", async () => {
      await createIncident("low", "Incident A", ["sys-a"]);
      await createIncident("high", "Incident B", ["sys-b"]);
      await createIncident("critical", "Incident C", ["sys-c"]);

      const all = await listIncidents();
      expect(all).toHaveLength(3);
    });

    test("filters by status", async () => {
      const a = await createIncident("low", "Open one", []);
      await createIncident("high", "Another", []);
      await updateIncident(a.id, { status: "resolved" });

      const openOnly = await listIncidents("open");
      expect(openOnly).toHaveLength(1);
      expect(openOnly[0].status).toBe("open");

      const resolvedOnly = await listIncidents("resolved");
      expect(resolvedOnly).toHaveLength(1);
      expect(resolvedOnly[0].status).toBe("resolved");
    });

    test("respects limit parameter", async () => {
      for (let i = 0; i < 10; i++) {
        await createIncident("low", `Bulk incident ${i}`, []);
      }

      const limited = await listIncidents(undefined, 3);
      expect(limited).toHaveLength(3);
    });

    test("returns empty array when no incidents exist", async () => {
      const all = await listIncidents();
      expect(all).toEqual([]);
    });
  });

  // ── generateIncidentReport ──

  describe("generateIncidentReport", () => {
    test("generates a full report for an existing incident", async () => {
      const incident = await createIncident("high", "Payment gateway timeout", ["payment-svc", "billing-svc"], "ops-2");
      await updateIncident(incident.id, {
        status: "resolved",
        rootCause: "Connection pool exhaustion under load",
        correctiveAction: "Increased pool size and added circuit breaker",
      });

      const report = await generateIncidentReport(incident.id);

      expect(report.incident.id).toBe(incident.id);
      expect(report.incident.status).toBe("resolved");
      expect(report.incident.rootCause).toBe("Connection pool exhaustion under load");
      expect(report.incident.correctiveAction).toBe("Increased pool size and added circuit breaker");

      expect(report.timeline.length).toBeGreaterThanOrEqual(3);
      expect(report.timeline[0].action).toBe("detected");

      const actions = report.timeline.map((t) => t.action);
      expect(actions).toContain("root_cause_identified");
      expect(actions).toContain("corrective_action");
      expect(actions).toContain("resolved");

      expect(report.summary).toContain("HIGH");
      expect(report.summary).toContain("Payment gateway timeout");
      expect(report.summary).toContain("payment-svc");
      expect(report.summary).toContain("Connection pool exhaustion");
    });

    test("throws when incident not found", async () => {
      await expect(generateIncidentReport("nonexistent-id")).rejects.toThrow(/not found/);
    });

    test("report summary reflects open status for unresolved incidents", async () => {
      const incident = await createIncident("critical", "Unresolved critical", ["core-api"]);
      const report = await generateIncidentReport(incident.id);

      expect(report.summary).toContain("CRITICAL");
      expect(report.summary).toContain("Currently unresolved");
    });
  });
});
