/**
 * Tests for Feature Flags service.
 *
 * Covers:
 * - setFlag: create new flag, update existing flag, rollout percentage clamping
 * - getFlag: retrieve by name, returns null for missing
 * - getAllFlags: returns all flags ordered by creation date
 * - isEnabled: disabled flag returns false, 100% rollout returns true,
 *   0% rollout returns false, percentage-based rollout is deterministic
 * - deleteFlag: removes flag, returns false for missing
 */

import {
  isEnabled,
  getAllFlags,
  setFlag,
  getFlag,
  deleteFlag,
} from "../src/services/infra/featureFlags";
import { sqlRun, closeLibsqlClient } from "../src/server/libsqlDb";

afterAll(() => {
  closeLibsqlClient();
});

// Clean up feature_flags table before each test to ensure isolation
beforeEach(async () => {
  await sqlRun("DELETE FROM feature_flags").catch(() => {});
});

describe("featureFlags", () => {
  /* ---------------------------------------------------------------- */
  /*  setFlag                                                          */
  /* ---------------------------------------------------------------- */

  describe("setFlag", () => {
    test("creates a new flag with the given name and enabled state", async () => {
      await setFlag("dark-mode", true);

      const flag = await getFlag("dark-mode");
      expect(flag).not.toBeNull();
      expect(flag!.name).toBe("dark-mode");
      expect(flag!.enabled).toBe(true);
      expect(flag!.rollout_percentage).toBe(100);
    });

    test("creates a flag with a custom rollout percentage", async () => {
      await setFlag("beta-feature", true, 25);

      const flag = await getFlag("beta-feature");
      expect(flag).not.toBeNull();
      expect(flag!.enabled).toBe(true);
      expect(flag!.rollout_percentage).toBe(25);
    });

    test("updates an existing flag when setFlag is called again with the same name", async () => {
      await setFlag("new-ui", true, 50);
      await setFlag("new-ui", false, 75);

      const flag = await getFlag("new-ui");
      expect(flag).not.toBeNull();
      expect(flag!.enabled).toBe(false);
      expect(flag!.rollout_percentage).toBe(75);
    });

    test("clamps rollout percentage to 0-100 range", async () => {
      await setFlag("clamped-high", true, 150);
      const high = await getFlag("clamped-high");
      expect(high!.rollout_percentage).toBe(100);

      await setFlag("clamped-low", true, -10);
      const low = await getFlag("clamped-low");
      expect(low!.rollout_percentage).toBe(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  getFlag                                                          */
  /* ---------------------------------------------------------------- */

  describe("getFlag", () => {
    test("returns null for a non-existent flag", async () => {
      const flag = await getFlag("does-not-exist");
      expect(flag).toBeNull();
    });

    test("returns the correct flag by name", async () => {
      await setFlag("flag-a", true);
      await setFlag("flag-b", false);

      const flag = await getFlag("flag-b");
      expect(flag).not.toBeNull();
      expect(flag!.name).toBe("flag-b");
      expect(flag!.enabled).toBe(false);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  getAllFlags                                                       */
  /* ---------------------------------------------------------------- */

  describe("getAllFlags", () => {
    test("returns an empty array when no flags exist", async () => {
      const flags = await getAllFlags();
      expect(flags).toEqual([]);
    });

    test("returns all created flags", async () => {
      await setFlag("alpha", true);
      await setFlag("beta", false);
      await setFlag("gamma", true, 50);

      const flags = await getAllFlags();
      expect(flags).toHaveLength(3);
      const names = flags.map((f) => f.name);
      expect(names).toContain("alpha");
      expect(names).toContain("beta");
      expect(names).toContain("gamma");
    });
  });

  /* ---------------------------------------------------------------- */
  /*  isEnabled                                                        */
  /* ---------------------------------------------------------------- */

  describe("isEnabled", () => {
    test("returns false for a non-existent flag", async () => {
      expect(await isEnabled("missing-flag")).toBe(false);
    });

    test("returns false when the flag is disabled", async () => {
      await setFlag("disabled-flag", false);
      expect(await isEnabled("disabled-flag")).toBe(false);
    });

    test("returns true when the flag is enabled with 100% rollout", async () => {
      await setFlag("full-rollout", true, 100);
      expect(await isEnabled("full-rollout")).toBe(true);
    });

    test("returns false when the flag is enabled with 0% rollout", async () => {
      await setFlag("zero-rollout", true, 0);
      expect(await isEnabled("zero-rollout")).toBe(false);
    });

    test("deterministic rollout: same userId always gets the same result", async () => {
      await setFlag("partial-rollout", true, 50);

      // The result for a given userId should be consistent across calls
      const first = await isEnabled("partial-rollout", "user-123");
      const second = await isEnabled("partial-rollout", "user-123");
      const third = await isEnabled("partial-rollout", "user-123");

      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    test("different users may get different results under partial rollout", async () => {
      await setFlag("split-rollout", true, 50);

      // With enough users, we expect at least one true and one false
      const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) => isEnabled("split-rollout", `user-${i}`)),
      );

      const hasTrue = results.some(Boolean);
      const hasFalse = results.some((r) => !r);
      expect(hasTrue).toBe(true);
      expect(hasFalse).toBe(true);
    });

    test("without userId, rollout is probabilistic (non-deterministic across calls)", async () => {
      await setFlag("anon-rollout", true, 50);

      // Run many times without a userId — should see a mix of true/false
      const results = await Promise.all(
        Array.from({ length: 50 }, () => isEnabled("anon-rollout")),
      );

      const hasTrue = results.some(Boolean);
      const hasFalse = results.some((r) => !r);
      // Statistically near-certain with 50 trials at 50%
      expect(hasTrue).toBe(true);
      expect(hasFalse).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  deleteFlag                                                       */
  /* ---------------------------------------------------------------- */

  describe("deleteFlag", () => {
    test("deletes an existing flag and returns true", async () => {
      await setFlag("to-delete", true);
      const deleted = await deleteFlag("to-delete");
      expect(deleted).toBe(true);

      const flag = await getFlag("to-delete");
      expect(flag).toBeNull();
    });

    test("returns false when deleting a non-existent flag", async () => {
      const deleted = await deleteFlag("never-existed");
      expect(deleted).toBe(false);
    });
  });
});
