/**
 * Tests for feedbackService — submit, list, update status.
 */

import {
  submitFeedback,
  listFeedback,
  updateFeedbackStatus,
} from "../src/services/business/feedbackService";
import { sqlRun, sqlAll, closeLibsqlClient, sqlGet } from "../src/server/libsqlDb";

afterAll(() => {
  closeLibsqlClient();
});

beforeEach(async () => {
  await sqlRun("DELETE FROM feedback_submissions").catch(() => {});
});

describe("submitFeedback", () => {
  test("creates a feedback record with correct fields", async () => {
    const fb = await submitFeedback("user-1", "bug", "The FBA solver crashes on empty models", "/tools/fbasim");

    expect(fb.id).toBeDefined();
    expect(fb.userId).toBe("user-1");
    expect(fb.type).toBe("bug");
    expect(fb.description).toBe("The FBA solver crashes on empty models");
    expect(fb.pageUrl).toBe("/tools/fbasim");
    expect(fb.status).toBe("open");
    expect(fb.createdAt).toBeGreaterThan(0);
    expect(fb.updatedAt).toBe(fb.createdAt);
  });

  test("defaults pageUrl to null when omitted", async () => {
    const fb = await submitFeedback("user-2", "general", "Great platform!");

    expect(fb.pageUrl).toBeNull();
  });

  test("defaults pageUrl to null when empty string provided", async () => {
    const fb = await submitFeedback("user-3", "feature_request", "Add dark mode toggle", "  ");

    expect(fb.pageUrl).toBeNull();
  });

  test("persists feedback in the database", async () => {
    const fb = await submitFeedback("user-4", "bug", "Page not loading");

    const rows = await sqlAll("SELECT * FROM feedback_submissions WHERE id = ?", [fb.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe("user-4");
    expect(rows[0].type).toBe("bug");
    expect(rows[0].status).toBe("open");
  });

  test("throws on empty userId", async () => {
    await expect(submitFeedback("", "bug", "test")).rejects.toThrow("userId is required");
  });

  test("throws on invalid type", async () => {
    await expect(submitFeedback("u1", "invalid" as never, "test")).rejects.toThrow("Invalid feedback type");
  });

  test("throws on empty description", async () => {
    await expect(submitFeedback("u1", "bug", "")).rejects.toThrow("description is required");
  });
});

describe("listFeedback", () => {
  test("returns all feedback ordered by created_at descending", async () => {
    // Insert with deliberate timestamp gaps to ensure deterministic ordering
    const fb1 = await submitFeedback("u1", "bug", "First bug");
    // Bump the first record's timestamp into the past
    await sqlRun("UPDATE feedback_submissions SET created_at = ? WHERE id = ?", [fb1.createdAt - 2000, fb1.id]);

    const fb2 = await submitFeedback("u2", "feature_request", "A feature");
    await sqlRun("UPDATE feedback_submissions SET created_at = ? WHERE id = ?", [fb2.createdAt - 1000, fb2.id]);

    await submitFeedback("u3", "general", "General comment");

    const all = await listFeedback();
    expect(all).toHaveLength(3);
    expect(all[0].description).toBe("General comment");
    expect(all[1].description).toBe("A feature");
    expect(all[2].description).toBe("First bug");
  });

  test("filters by status", async () => {
    const fb1 = await submitFeedback("u1", "bug", "Open bug");
    await submitFeedback("u2", "feature_request", "Open feature");

    // Update one to resolved
    await updateFeedbackStatus(fb1.id, "resolved");

    const openOnly = await listFeedback("open");
    expect(openOnly).toHaveLength(1);
    expect(openOnly[0].description).toBe("Open feature");

    const resolvedOnly = await listFeedback("resolved");
    expect(resolvedOnly).toHaveLength(1);
    expect(resolvedOnly[0].description).toBe("Open bug");
  });

  test("returns empty array when no feedback exists", async () => {
    const result = await listFeedback();
    expect(result).toEqual([]);
  });

  test("throws on invalid status filter", async () => {
    await expect(listFeedback("bogus" as never)).rejects.toThrow("Invalid feedback status");
  });
});

describe("updateFeedbackStatus", () => {
  test("updates the status of an existing record", async () => {
    const fb = await submitFeedback("u1", "bug", "Needs fixing");
    expect(fb.status).toBe("open");

    await updateFeedbackStatus(fb.id, "in_review");

    const rows = await listFeedback();
    expect(rows[0].status).toBe("in_review");
    expect(rows[0].updatedAt).toBeGreaterThanOrEqual(fb.createdAt);
  });

  test("throws when feedback id does not exist", async () => {
    await expect(updateFeedbackStatus("nonexistent-id", "resolved")).rejects.toThrow("not found");
  });

  test("throws on invalid status", async () => {
    const fb = await submitFeedback("u1", "bug", "Test");
    await expect(updateFeedbackStatus(fb.id, "invalid" as never)).rejects.toThrow("Invalid feedback status");
  });

  test("throws on empty id", async () => {
    await expect(updateFeedbackStatus("", "resolved")).rejects.toThrow("id is required");
  });
});
